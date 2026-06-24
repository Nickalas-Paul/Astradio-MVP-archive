import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId, SESSION_COOKIE_NAME, LEGACY_COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';

  const engineUrl = getEngineBaseUrl();
  const resp = await fetch(`${engineUrl}/api/auth/account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...engineProxySessionHeaders(userId),
    },
    body: JSON.stringify({ password }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    return NextResponse.json(err, { status: resp.status });
  }

  const response = NextResponse.json({ deleted: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(LEGACY_COOKIE_NAME);
  return response;
}
