import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const backend = getEngineBaseUrl();
    const url = new URL(`${backend}/api/community/signals/recent`);
    url.searchParams.set('userId', userId);
    const limit = req.nextUrl.searchParams.get('limit');
    if (limit) url.searchParams.set('limit', limit);
    const r = await fetch(url.toString(), { headers: engineProxyHeaders({ Accept: 'application/json' }), cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Recent signals unavailable' },
      { status: 502 }
    );
  }
}
