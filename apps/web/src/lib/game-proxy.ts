/**
 * Shared helper for Phase 5 game BFF proxies (session → engine).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export async function proxyGameRequest(
  req: NextRequest,
  campaignId: string,
  pathSuffix: string,
  method: 'GET' | 'POST'
): Promise<NextResponse> {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const backend = getEngineBaseUrl();
    const url = new URL(
      `${backend}/api/game/${encodeURIComponent(campaignId)}${pathSuffix}`
    );
    url.searchParams.set('userId', userId);
    for (const [key, value] of req.nextUrl.searchParams.entries()) {
      if (key === 'userId') continue;
      url.searchParams.set(key, value);
    }

    const init: RequestInit = {
      method,
      headers: engineProxyHeaders({
        Accept: 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      }),
    };
    if (method === 'POST') {
      const body = await req.json().catch(() => ({}));
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), init);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Game API unavailable' },
      { status: 502 }
    );
  }
}
