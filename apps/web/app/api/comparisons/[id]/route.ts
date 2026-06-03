/**
 * Proxy to backend GET /api/comparisons/:id (Community Compatibility V1).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const backend = getEngineBaseUrl();
    const { id } = await params;
    const r = await fetch(`${backend}/api/comparisons/${id}`, {
      headers: engineProxyHeaders({ Accept: 'application/json' })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Comparison unavailable' },
      { status: 502 }
    );
  }
}
