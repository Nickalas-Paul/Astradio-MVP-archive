/**
 * Proxies POST /api/auth/login to engine; sets astradio_session on success.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  LEGACY_COOKIE_NAME,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!process.env.ASTRADIO_SESSION_SECRET || process.env.ASTRADIO_SESSION_SECRET.length < 32) {
    return NextResponse.json(
      { error: 'ASTRADIO_SESSION_SECRET must be set (min 32 chars) for authentication' },
      { status: 503 },
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/auth/login`, {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    const uid = data?.user?.id;
    if (typeof uid !== 'string' || !uid.trim()) {
      return NextResponse.json({ error: 'invalid_login_response' }, { status: 502 });
    }
    const res = NextResponse.json(data, { status: 200 });
    res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(uid.trim()), SESSION_COOKIE_OPTIONS);
    res.cookies.delete(LEGACY_COOKIE_NAME);
    return res;
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Login unavailable' },
      { status: 502 },
    );
  }
}
