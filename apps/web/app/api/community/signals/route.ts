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
    const url = new URL(`${backend}/api/community/signals`);
    url.searchParams.set('userId', userId);
    const r = await fetch(url.toString(), { headers: engineProxyHeaders({ Accept: 'application/json' }), cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'signals failed' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/community/signals`, {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({ ...(body as object), userId }),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'create signal failed' },
      { status: 502 }
    );
  }
}
