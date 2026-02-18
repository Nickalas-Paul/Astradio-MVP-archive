import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

// Proxy to backend /chart (Render). No Swiss Ephemeris in web app.

export async function GET(req: NextRequest) {
  const backend = getEngineBaseUrl();
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const url = qs ? `${backend}/chart?${qs}` : `${backend}/chart`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Chart unavailable' }, { status: 502 });
  }
}
