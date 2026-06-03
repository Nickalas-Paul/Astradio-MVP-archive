import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const backend = getEngineBaseUrl();
    const { id, memberId } = await params;
    const url = new URL(`${backend}/api/groups/${id}/members/${memberId}`);
    url.searchParams.set('userId', userId);
    const r = await fetch(url.toString(), { method: 'DELETE' });
    if (r.status === 204) return new NextResponse(null, { status: 204 });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Group membership unavailable' },
      { status: 502 }
    );
  }
}
