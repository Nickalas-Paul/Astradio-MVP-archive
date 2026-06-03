/**
 * Profile avatar upload/remove. Proxies multipart to engine /api/profile/avatar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const incoming = await req.formData();
    const file = incoming.get('avatar');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const outbound = new FormData();
    const name = file instanceof File && file.name ? file.name : 'avatar.jpg';
    outbound.append('avatar', file, name);

    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile/avatar`, {
      method: 'POST',
      headers: {
        'x-proxy-session-user-id': userId,
      },
      body: outbound,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Avatar upload failed' }, { status: 502 });
  }
}

export async function DELETE(_req: NextRequest) {
  const userId = getSessionUserId(_req.cookies);
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile/avatar`, {
      method: 'DELETE',
      headers: {
        'x-proxy-session-user-id': userId,
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Avatar remove failed' }, { status: 502 });
  }
}
