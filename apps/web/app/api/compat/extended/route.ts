/**
 * Proxy to engine GET /api/compat/extended (profile-depth synastry bullets).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/compat/extended${qs ? `?${qs}` : ''}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/compat/extended] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Extended compatibility unavailable' },
      { status: 502 }
    );
  }
}
