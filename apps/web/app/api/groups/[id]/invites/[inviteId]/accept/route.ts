import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const { id, inviteId } = await params;
    const backend = getEngineBaseUrl();
    const url = new URL(
      `${backend}/api/groups/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}/accept`
    );
    url.searchParams.set('userId', userId);
    const r = await fetch(url.toString(), {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({}),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'accept invite failed' },
      { status: 502 }
    );
  }
}
