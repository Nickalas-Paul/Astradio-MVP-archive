/**
 * Proxies POST /api/community/relational-feed to the engine (relational weather feed).
 * userId in body comes from session only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sessionUserId = getSessionUserId(req.cookies);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const raw = await req.json().catch(() => ({}));
    const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
    delete (body as Record<string, unknown>).userId;
    (body as Record<string, unknown>).userId = sessionUserId;
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/community/relational-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Relational feed unavailable' },
      { status: 502 }
    );
  }
}
