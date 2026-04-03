/**
 * Proxies POST /api/auth/register to engine; sets astradio_session on success.
 * Requires ASTRADIO_SESSION_SECRET (no legacy cookie fallback for auth).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  LEGACY_COOKIE_NAME,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

function authSessionUnavailable() {
  return NextResponse.json(
    { error: 'ASTRADIO_SESSION_SECRET must be set (min 32 chars) for authentication' },
    { status: 503 },
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.ASTRADIO_SESSION_SECRET || process.env.ASTRADIO_SESSION_SECRET.length < 32) {
    return authSessionUnavailable();
  }
  try {
    const body = await req.json().catch(() => ({}));
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    const uid = data?.user?.id;
    if (typeof uid !== 'string' || !uid.trim()) {
      return NextResponse.json({ error: 'invalid_register_response' }, { status: 502 });
    }
    const res = NextResponse.json(data, { status: 201 });
    res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(uid.trim()), SESSION_COOKIE_OPTIONS);
    res.cookies.delete(LEGACY_COOKIE_NAME);
    return res;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Register unavailable' },
      { status: 502 },
    );
  }
}
