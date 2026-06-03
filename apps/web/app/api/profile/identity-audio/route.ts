/**
 * Proxy to engine POST /api/profile/identity-audio (user-initiated natal identity soundtrack).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sessionUserId = getSessionUserId(req.cookies);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/profile/identity-audio`, {
      method: 'POST',
      headers: engineProxySessionHeaders(sessionUserId, { 'Content-Type': 'application/json' }),
      credentials: 'same-origin',
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/profile/identity-audio] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Identity audio unavailable' },
      { status: 502 },
    );
  }
}
