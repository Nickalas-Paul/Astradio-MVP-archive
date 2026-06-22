/**
 * Proxy to backend GET /api/comparisons/:id (Community Compatibility V1).
 * Forwards session so the engine can serve viewer-oriented compatibility text.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const backend = getEngineBaseUrl();
    const { id } = await params;
    const userId = getSessionUserId(req.cookies);
    const headers = userId
      ? engineProxySessionHeaders(userId, { Accept: 'application/json' })
      : engineProxyHeaders({ Accept: 'application/json' });
    const r = await fetch(`${backend}/api/comparisons/${encodeURIComponent(id)}`, {
      headers,
      cache: 'no-store',
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
