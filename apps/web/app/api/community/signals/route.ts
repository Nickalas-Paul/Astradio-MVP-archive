import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const backend = getEngineBaseUrl();
    const url = new URL(`${backend}/api/community/signals`);
    url.searchParams.set('userId', userId);
    const r = await fetch(url.toString(), { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'signals failed' },
      { status: 502 }
    );
  }
}
