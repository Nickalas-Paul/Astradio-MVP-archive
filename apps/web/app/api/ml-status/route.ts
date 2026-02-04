import { NextResponse } from 'next/server';

/** Proxy GET /api/ml-status to Render. Same-origin so no CORS. */
export async function GET() {
  try {
    const backend = (process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const r = await fetch(`${backend}/api/ml-status`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'ml-status unavailable' }, { status: 502 });
  }
}
