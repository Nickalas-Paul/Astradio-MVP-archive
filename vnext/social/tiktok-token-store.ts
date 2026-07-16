import fs from 'fs';
import path from 'path';

export type TikTokTokens = {
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_at: string;
  updated_at: string;
};

const TOKEN_FILE = path.join(process.cwd(), 'vnext', 'social', '.tiktok-tokens.json');

function ensureDir(): void {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getTokenFilePath(): string {
  return TOKEN_FILE;
}

export function loadTikTokTokens(): TikTokTokens | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TikTokTokens>;
    if (
      typeof parsed.access_token !== 'string' ||
      typeof parsed.refresh_token !== 'string' ||
      typeof parsed.open_id !== 'string' ||
      typeof parsed.expires_at !== 'string'
    ) {
      return null;
    }
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      open_id: parsed.open_id,
      expires_at: parsed.expires_at,
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : parsed.expires_at,
    };
  } catch {
    return null;
  }
}

export function saveTikTokTokens(tokens: Omit<TikTokTokens, 'updated_at'> & { updated_at?: string }): void {
  ensureDir();
  const record: TikTokTokens = {
    ...tokens,
    updated_at: tokens.updated_at ?? new Date().toISOString(),
  };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(record, null, 2), 'utf8');
}

export function isTokenExpired(tokens: TikTokTokens, skewMs = 60_000): boolean {
  const expiresAt = Date.parse(tokens.expires_at);
  if (!Number.isFinite(expiresAt)) return true;
  return Date.now() + skewMs >= expiresAt;
}

export function tokenStatus(): {
  connected: boolean;
  expired: boolean;
  open_id?: string;
  expires_at?: string;
  updated_at?: string;
} {
  const tokens = loadTikTokTokens();
  if (!tokens) {
    return { connected: false, expired: false };
  }
  return {
    connected: true,
    expired: isTokenExpired(tokens),
    open_id: tokens.open_id,
    expires_at: tokens.expires_at,
    updated_at: tokens.updated_at,
  };
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  error?: string;
  error_description?: string;
  message?: string;
};

function getTikTokCredentials(): { clientKey: string; clientSecret: string } {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) {
    throw new Error('TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set');
  }
  return { clientKey, clientSecret };
}

async function exchangeToken(body: Record<string, string>): Promise<TikTokTokens> {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { data?: TokenResponse };
  const data = (json.data ?? json) as TokenResponse;
  if (!res.ok || !data.access_token) {
    console.error('[tiktok-auth] token exchange failed', {
      status: res.status,
      body: json,
    });
    const msg =
      data.error_description ||
      data.message ||
      data.error ||
      `TikTok token exchange failed (${res.status})`;
    throw new Error(msg);
  }
  const expiresIn = Number(data.expires_in) > 0 ? Number(data.expires_in) : 3600;
  const now = Date.now();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || body.refresh_token || '',
    open_id: data.open_id || loadTikTokTokens()?.open_id || '',
    expires_at: new Date(now + expiresIn * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
}

export async function storeTokensFromAuthCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TikTokTokens> {
  const { clientKey, clientSecret } = getTikTokCredentials();
  const tokens = await exchangeToken({
    client_key: clientKey,
    client_secret: clientSecret,
    code: params.code,
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
  saveTikTokTokens(tokens);
  return tokens;
}

export async function refreshTikTokTokens(refreshToken: string): Promise<TikTokTokens> {
  const { clientKey, clientSecret } = getTikTokCredentials();
  const tokens = await exchangeToken({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  if (!tokens.refresh_token) {
    tokens.refresh_token = refreshToken;
  }
  saveTikTokTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = loadTikTokTokens();
  if (!tokens) {
    throw new Error('TikTok not connected. Visit /api/social/tiktok/authorize first.');
  }
  if (!isTokenExpired(tokens)) {
    return tokens.access_token;
  }
  const refreshed = await refreshTikTokTokens(tokens.refresh_token);
  return refreshed.access_token;
}
