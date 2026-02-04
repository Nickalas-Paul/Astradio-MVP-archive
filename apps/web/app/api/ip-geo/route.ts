import { NextRequest, NextResponse } from 'next/server';

function randomRequestId(): string {
  return `ipgeo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Proxy GET /api/ip-geo to Render. Same-origin so no CORS. Forward client IP for geo. */
export async function GET(req: NextRequest) {
  const requestId = randomRequestId();
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store');

  try {
    const base = (process.env.API_BASE_URL ?? process.env.BACKEND_URL ?? 'http://localhost:3000').trim().replace(/\/+$/, '');
    const url = `${base}/api/ip-geo`;
    const fwdHeaders: Record<string, string> = { Accept: 'application/json' };
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const userAgent = req.headers.get('user-agent');
    if (forwarded) fwdHeaders['x-forwarded-for'] = forwarded;
    if (realIp) fwdHeaders['x-real-ip'] = realIp;
    if (userAgent) fwdHeaders['user-agent'] = userAgent;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(url, {
      headers: fwdHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const body = {
        status: 'error' as const,
        upstream_status: r.status,
        message: (data && typeof data.error === 'string' ? data.error : `upstream ${r.status}`),
        request_id: requestId,
      };
      console.error('[ip-geo]', requestId, url, 'upstream_status', r.status);
      return NextResponse.json(body, { status: r.status, headers });
    }

    return NextResponse.json(data, { headers });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[ip-geo]', requestId, 'url=', (process.env.API_BASE_URL ?? '').replace(/\/+$/, '') + '/api/ip-geo', message);
    const body = {
      status: 'error' as const,
      message: 'ip-geo proxy failed',
      request_id: requestId,
    };
    return NextResponse.json(body, { status: 502, headers });
  }
}
