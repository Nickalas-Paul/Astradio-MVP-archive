/**
 * Proxy to engine POST /api/compatibility/intent (curated clusters - Phase 2).
 * Body: { seekerChartId?, chart?, intent, limit?, facets? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/compatibility/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/compatibility/intent] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Compatibility intent service unavailable' },
      { status: 502 }
    );
  }
}
