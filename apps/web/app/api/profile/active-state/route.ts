/**
 * Proxy to engine POST /api/profile/active-state (A + C(t) overlay projection).
 * userId comes from session via x-proxy-session-user-id (not client body).
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
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/profile/active-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-proxy-session-user-id': sessionUserId,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/profile/active-state] proxy error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Profile active state unavailable' },
      { status: 502 }
    );
  }
}
