/**
 * Proxy to engine GET /api/compat/health.
 */
import { NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export async function GET() {
  try {
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/compat/health`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/compat/health] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Compat health unavailable' },
      { status: 502 }
    );
  }
}
