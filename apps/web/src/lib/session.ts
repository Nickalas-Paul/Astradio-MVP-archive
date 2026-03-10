/**
 * Phase 8H — Session Identity Layer.
 * Signed HTTP-only cookie for deterministic userId resolution across refreshes.
 * Compatible with pg-store; no engine changes.
 */

import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE_NAME = 'astradio_session';
export const LEGACY_COOKIE_NAME = 'astradio_dev_user_id';

const MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 year
const MAX_ISSUED_AGE_MS = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years (reject older)

export interface SessionPayload {
  userId: string;
  issuedAt: number;
}

/** Minimal cookie reader: get(name) => { value: string } | undefined */
export interface CookieStore {
  get(name: string): { value: string } | undefined;
}

function getSecret(): string {
  const secret = process.env.ASTRADIO_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'ASTRADIO_SESSION_SECRET must be set and at least 32 characters (session layer)'
    );
  }
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (3 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/**
 * Sign a session payload and return the full cookie value: base64url(payload).signature
 */
export function signSession(payload: SessionPayload): string {
  const secret = getSecret();
  const payloadJson = JSON.stringify({ userId: payload.userId, issuedAt: payload.issuedAt });
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson, 'utf8'));
  const sig = createHmac('sha256', secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify and parse a session cookie value. Returns payload or null if invalid.
 */
export function verifySession(cookieValue: string): SessionPayload | null {
  if (!cookieValue || typeof cookieValue !== 'string') return null;
  const dot = cookieValue.indexOf('.');
  if (dot <= 0 || dot === cookieValue.length - 1) return null;
  const payloadB64 = cookieValue.slice(0, dot);
  const sigB64 = cookieValue.slice(dot + 1);
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }
  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest();
  const expectedB64 = base64UrlEncode(expectedSig);
  if (expectedB64.length !== sigB64.length || !timingSafeEqual(Buffer.from(expectedB64, 'utf8'), Buffer.from(sigB64, 'utf8'))) {
    return null;
  }
  let payload: unknown;
  try {
    const raw = base64UrlDecode(payloadB64).toString('utf8');
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof (payload as SessionPayload).userId !== 'string' ||
    typeof (payload as SessionPayload).issuedAt !== 'number'
  ) {
    return null;
  }
  const { userId, issuedAt } = payload as SessionPayload;
  if (!userId.trim()) return null;
  if (Date.now() - issuedAt > MAX_ISSUED_AGE_MS) return null;
  return { userId: userId.trim(), issuedAt };
}

/**
 * Resolve current user id from cookies. Prefers signed astradio_session; falls back to legacy astradio_dev_user_id.
 */
export function getSessionUserId(cookies: CookieStore): string | null {
  const sessionCookie = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) {
    const payload = verifySession(sessionCookie);
    if (payload) return payload.userId;
  }
  const legacy = cookies.get(LEGACY_COOKIE_NAME)?.value;
  if (legacy && typeof legacy === 'string' && legacy.trim()) return legacy.trim();
  return null;
}

const isProduction = process.env.NODE_ENV === 'production';

/** Cookie options for setting astradio_session (e.g. on profile creation). */
export const SESSION_COOKIE_OPTIONS = {
  path: '/' as const,
  maxAge: MAX_AGE_SEC,
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
};

/**
 * Create the signed cookie value for a given userId. Use with NextResponse.cookies.set.
 */
export function createSessionCookieValue(userId: string): string {
  return signSession({ userId, issuedAt: Date.now() });
}
