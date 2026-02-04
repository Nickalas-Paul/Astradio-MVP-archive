import { NextRequest, NextResponse } from 'next/server';

/** Proxy GET /api/ip-geo to Render. Same-origin so no CORS. Forward client IP for geo. */
export async function GET(req: NextRequest) {
  try {
    const backend = (process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const url = `${backend}/api/ip-geo`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    if (forwarded) headers['x-forwarded-for'] = forwarded;
    if (realIp) headers['x-real-ip'] = realIp;
    const r = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { lat: null, lon: null, city: 'Auto (Unknown)', country: null },
      { status: 502 }
    );
  }
}
