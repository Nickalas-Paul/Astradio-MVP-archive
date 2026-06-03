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
    const body = await req.json().catch(() => ({}));
    const url = new URL(`${backend}/api/campaigns/${encodeURIComponent(id)}/daily/resolve`);
    url.searchParams.set('userId', userId);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Campaign resolve unavailable' },
      { status: 502 }
    );
  }
}
