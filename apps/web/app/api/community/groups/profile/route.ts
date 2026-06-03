/**
 * Proxy to engine POST /api/community/groups/profile (GroupProfile - Phase 2).
 * Body: { groupId, chartIds?: string[], featureVecs?: number[][], aggregationMode?, seed? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/community/groups/profile`, {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/community/groups/profile] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Group profile service unavailable' },
      { status: 502 }
    );
  }
}
