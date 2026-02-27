/**
 * Phase 4 — Community feed. Proxies to engine GET /api/community/feed.
 * Deterministic: created_at DESC, id ASC tie-break.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/community/feed${qs ? `?${qs}` : ''}`);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Community feed unavailable' },
      { status: 502 }
    );
  }
}
