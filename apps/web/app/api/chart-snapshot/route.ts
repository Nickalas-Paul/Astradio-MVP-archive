import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';

// Proxy to backend /api/chart-snapshot (Swiss Ephemeris → EphemerisSnapshot).
export async function GET(req: NextRequest) {
  const backend = getEngineBaseUrl();
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const url = qs ? `${backend}/api/chart-snapshot?${qs}` : `${backend}/api/chart-snapshot`;

  try {
    const r = await fetch(url, { headers: engineProxyHeaders({ Accept: 'application/json' }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'chart-snapshot unavailable' }, { status: 502 });
  }
}

