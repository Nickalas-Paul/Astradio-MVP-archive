import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const backend = getEngineBaseUrl();
    const { id } = await params;
    const url = new URL(`${backend}/api/campaigns/${encodeURIComponent(id)}/enter`);
    url.searchParams.set('userId', userId);
    const r = await fetch(url.toString(), {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(req.json ? await req.json().catch(() => ({})) : {}),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Campaign enter unavailable' },
      { status: 502 }
    );
  }
}
