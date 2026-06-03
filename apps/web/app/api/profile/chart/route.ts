/**
 * Proxy to engine GET /api/profile/chart (chart snapshot + explainer from vnext).
 * Query: chartId (optional; default = chart_profile_default).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders } from '@/lib/engine-proxy-headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chartId = searchParams.get('chartId') ?? undefined;
    const qs = chartId ? `?chartId=${encodeURIComponent(chartId)}` : '';
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/profile/chart${qs}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
      headers: engineProxyHeaders(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/profile/chart] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Profile chart unavailable' },
      { status: 502 }
    );
  }
}
