/**
 * Proxy to engine GET /api/compat/matches. Passes query string through (chartId, mode, limit, cursor).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/compat/matches${qs ? `?${qs}` : ''}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/compat/matches] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Compat matches unavailable' },
      { status: 502 }
    );
  }
}
