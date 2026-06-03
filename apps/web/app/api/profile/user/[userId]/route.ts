/**
 * Profile by user id. Proxies GET to engine /api/profile?userId=
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const sessionUserId = getSessionUserId(req.cookies);
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const { userId } = await params;
    if (!userId?.trim() || userId.trim() !== sessionUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile?userId=${encodeURIComponent(sessionUserId)}`, {
      headers: engineProxySessionHeaders(sessionUserId),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Profile fetch failed' },
      { status: 502 }
    );
  }
}
