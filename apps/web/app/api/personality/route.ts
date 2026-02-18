/**
 * Proxy to engine POST /api/personality (Personality API - Phase 1 Foundation).
 * Body: { chart: { date, time, lat, lon }, seed? } or { chartId: string, seed? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/personality`, {
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
    console.error('[api/personality] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Personality service unavailable' },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chartId = searchParams.get('chartId');
    if (!chartId) {
      return NextResponse.json({ error: 'chartId is required' }, { status: 400 });
    }
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/personality/${chartId}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/personality] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Personality service unavailable' },
      { status: 502 }
    );
  }
}
