/**
 * Proxy to engine POST /api/compatibility/intent (curated clusters - Phase 2).
 * seekerUserId is always stamped from session (never trusted from client).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { getSessionUserId } from '@/lib/session';

export async function POST(req: NextRequest) {
  const sessionUserId = getSessionUserId(req.cookies);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = { ...body, seekerUserId: sessionUserId };
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/compatibility/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
