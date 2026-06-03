import { NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';

/** Proxy GET /api/ml-status to Render. Same-origin so no CORS. */
export async function GET() {
  try {
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/ml-status`, {
      headers: engineProxyHeaders({ Accept: 'application/json' }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'ml-status unavailable' }, { status: 502 });
  }
}
