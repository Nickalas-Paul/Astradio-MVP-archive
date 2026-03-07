/**
 * Proxy to engine GET /api/user/history (export dir list).
 * Phase 8C: same-origin frontend can call this without 404.
 * Forwards x-beta-user from dev cookie when present (same pattern as /api/exports).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export const dynamic = 'force-dynamic';

const DEV_USER_COOKIE = 'astradio_dev_user_id';

export async function GET(req: NextRequest) {
  try {
    const backend = getEngineBaseUrl();
    const url = new URL(req.url);
    const query = url.searchParams.toString();
    const headers: Record<string, string> = {};
    const betaUser = req.cookies.get(DEV_USER_COOKIE)?.value || '';
    if (betaUser) {
      headers['x-beta-user'] = betaUser;
    }
    const r = await fetch(`${backend}/api/user/history${query ? `?${query}` : ''}`, { headers });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(
        typeof data === 'object' && data !== null ? data : { error: r.statusText },
        { status: r.status >= 400 ? r.status : 502 }
      );
    }
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'User history unavailable';
    console.error('[api/user/history] proxy error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
