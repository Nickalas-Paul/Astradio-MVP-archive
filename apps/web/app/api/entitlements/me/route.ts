import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionUserId = getSessionUserId(req.cookies);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/entitlements/me`, {
      method: 'GET',
      headers: engineProxySessionHeaders(sessionUserId, { Accept: 'application/json' }),
      credentials: 'same-origin',
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    console.error('[api/entitlements/me] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Entitlements unavailable' },
      { status: 502 },
    );
  }
}
