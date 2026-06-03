import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

async function proxyToEngine(
  req: NextRequest,
  id: string,
  method: 'GET' | 'POST'
) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const backend = getEngineBaseUrl();
    const url = new URL(`${backend}/api/campaigns/${encodeURIComponent(id)}/daily`);
    url.searchParams.set('userId', userId);
    const sp = req.nextUrl.searchParams;
    for (const key of ['date', 'time', 'engineVersion']) {
      const v = sp.get(key);
      if (v) url.searchParams.set(key, v);
    }
    if (method === 'GET') {
      const r = await fetch(url.toString(), { headers: engineProxyHeaders({ Accept: 'application/json' }) });
      const data = await r.json().catch(() => ({}));
      return NextResponse.json(data, { status: r.status });
    }
    const body = await req.json().catch(() => ({}));
    /* date/time/engineVersion may be on query string or body; backend merges both */
    const r = await fetch(url.toString(), {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Campaign daily unavailable' },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToEngine(req, id, 'GET');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyToEngine(req, id, 'POST');
}
