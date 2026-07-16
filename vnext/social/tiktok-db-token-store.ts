import path from 'path';

export type TikTokTokens = {
  access_token: string;
  refresh_token: string;
  open_id: string;
  expires_at: string;
  updated_at: string;
};

// Established runtime pattern: resolve from process.cwd() (repo root), not relative to dist/.
const { query, getRow } = require(path.join(process.cwd(), 'lib', 'database')) as {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  getRow: (text: string, params?: unknown[]) => Promise<Record<string, unknown> | null>;
};

export async function loadTikTokTokens(): Promise<TikTokTokens | null> {
  try {
    const row = await getRow(
      'SELECT access_token, refresh_token, open_id, expires_at, updated_at FROM tiktok_tokens ORDER BY created_at DESC LIMIT 1',
    );
    if (!row) return null;
    if (
      typeof row.access_token !== 'string' ||
      typeof row.refresh_token !== 'string' ||
      typeof row.open_id !== 'string' ||
      typeof row.expires_at !== 'string'
    ) {
      return null;
    }
    return {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      open_id: row.open_id,
      expires_at: row.expires_at,
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : row.expires_at,
    };
  } catch (err) {
    console.error(
      '[tiktok-db-token-store] loadTikTokTokens failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export async function saveTikTokTokens(
  tokens: Omit<TikTokTokens, 'updated_at'> & { updated_at?: string },
): Promise<void> {
  const updatedAt = tokens.updated_at || new Date().toISOString();
  await query(
    `INSERT INTO tiktok_tokens (open_id, access_token, refresh_token, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (open_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = EXCLUDED.updated_at`,
    [tokens.open_id, tokens.access_token, tokens.refresh_token, tokens.expires_at, updatedAt],
  );
}

export function isTokenExpired(tokens: TikTokTokens, skewMs = 60_000): boolean {
  const expiresAt = Date.parse(tokens.expires_at);
  if (!Number.isFinite(expiresAt)) return true;
  return Date.now() + skewMs >= expiresAt;
}

export async function tokenStatus(): Promise<{
  connected: boolean;
  expired: boolean;
  open_id?: string;
  expires_at?: string;
  updated_at?: string;
}> {
  const tokens = await loadTikTokTokens();
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
  const existing = await loadTikTokTokens();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || body.refresh_token || '',
    open_id: data.open_id || existing?.open_id || '',
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
  console.log('[tiktok-auth] token exchange payload', {
    client_key: clientKey,
    client_key_length: clientKey?.length,
    client_secret_length: clientSecret?.length,
    client_secret_first4: clientSecret?.slice(0, 4),
    client_secret_last4: clientSecret?.slice(-4),
    redirect_uri: params.redirectUri,
    code_length: params.code?.length,
    code_verifier_length: params.codeVerifier?.length,
  });
  const tokens = await exchangeToken({
    client_key: clientKey,
    client_secret: clientSecret,
    code: params.code,
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
  await saveTikTokTokens(tokens);
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
  await saveTikTokTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = await loadTikTokTokens();
  if (!tokens) {
    throw new Error('TikTok not connected. Visit /api/social/tiktok/authorize first.');
  }
  if (!isTokenExpired(tokens)) {
    return tokens.access_token;
  }
  const refreshed = await refreshTikTokTokens(tokens.refresh_token);
  return refreshed.access_token;
}
