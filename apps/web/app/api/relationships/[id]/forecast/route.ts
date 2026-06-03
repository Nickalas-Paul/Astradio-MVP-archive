import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const backend = getEngineBaseUrl();
    const { id } = await params;
    const url = new URL(`${backend}/api/relationships/${id}/forecast`);
    url.searchParams.set('userId', userId);
    const sp = req.nextUrl.searchParams;
    for (const key of [
      'transitDatetime',
      'transitLatitude',
      'transitLongitude',
      'transitTimezone',
      'compose',
      'generateAudio',
    ]) {
      const v = sp.get(key);
      if (v != null && v !== '') url.searchParams.set(key, v);
    }
    const r = await fetch(url.toString(), { headers: engineProxyHeaders({ Accept: 'application/json' }) });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Relationship forecast unavailable' },
      { status: 502 }
    );
  }
}
