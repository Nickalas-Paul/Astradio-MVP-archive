import crypto from 'crypto';
import type { Request, Response } from 'express';
import { storeTokensFromAuthCode } from './tiktok-db-token-store';

type PkceSession = {
  codeVerifier: string;
  expiresAt: number;
};

const PKCE_TTL_MS = 10 * 60 * 1000;
const pkceSessions = new Map<string, PkceSession>();

function purgeExpiredPkceSessions(): void {
  const now = Date.now();
  for (const [state, session] of pkceSessions.entries()) {
    if (session.expiresAt <= now) {
      pkceSessions.delete(state);
    }
  }
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

function requireTikTokOAuthConfig(): { clientKey: string; redirectUri: string } {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim();
  if (!clientKey) {
    throw new Error('TIKTOK_CLIENT_KEY is not configured');
  }
  if (!redirectUri) {
    throw new Error('TIKTOK_REDIRECT_URI is not configured');
  }
  return { clientKey, redirectUri };
}

export function handleTikTokAuthorize(req: Request, res: Response): void {
  try {
    purgeExpiredPkceSessions();
    const { clientKey, redirectUri } = requireTikTokOAuthConfig();
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    pkceSessions.set(state, {
      codeVerifier,
      expiresAt: Date.now() + PKCE_TTL_MS,
    });

    const params = new URLSearchParams({
      client_key: clientKey,
      scope: 'video.upload,video.publish',
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).send(`TikTok authorize failed: ${message}`);
  }
}

export async function handleTikTokCallback(req: Request, res: Response): Promise<void> {
  try {
    purgeExpiredPkceSessions();
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const error = typeof req.query.error === 'string' ? req.query.error : '';

    if (error) {
      res.status(400).send(`TikTok authorization denied: ${error}`);
      return;
    }
    if (!code || !state) {
      res.status(400).send('Missing code or state from TikTok callback');
      return;
    }

    const session = pkceSessions.get(state);
    pkceSessions.delete(state);
    if (!session || session.expiresAt <= Date.now()) {
      res.status(400).send('OAuth session expired or invalid state. Please try again.');
      return;
    }

    const { redirectUri } = requireTikTokOAuthConfig();
    await storeTokensFromAuthCode({
      code,
      codeVerifier: session.codeVerifier,
      redirectUri,
    });

    res
      .status(200)
      .type('html')
      .send('<html><body><h1>TikTok connected successfully.</h1><p>You can close this window.</p></body></html>');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[tiktok-auth] callback failed:', message);
    res.status(500).send(`TikTok callback failed: ${message}`);
  }
}
