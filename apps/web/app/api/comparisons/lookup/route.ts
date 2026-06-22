/**
 * Proxy to backend GET /api/comparisons/lookup — pair dedup for Sandbox/Listen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = getSessionUserId(req.cookies);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const chartA = req.nextUrl.searchParams.get('chartA')?.trim() || '';
    const chartB = req.nextUrl.searchParams.get('chartB')?.trim() || '';
    if (!chartA || !chartB) {
      return NextResponse.json({ error: 'chartA and chartB required' }, { status: 400 });
    }

    const backend = getEngineBaseUrl();
    const qs = new URLSearchParams({ chartA, chartB });
    const headers = engineProxySessionHeaders(userId, { Accept: 'application/json' });
    const r = await fetch(`${backend}/api/comparisons/lookup?${qs.toString()}`, {
      headers,
      cache: 'no-store',
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Comparison lookup unavailable' },
      { status: 502 }
    );
  }
}
