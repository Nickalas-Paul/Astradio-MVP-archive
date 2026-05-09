/**
 * Authenticated proxy to engine GET /api/charts/search (Sandbox chart import autocomplete).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = getSessionUserId(req.cookies);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const backend = getEngineBaseUrl();
    const target = new URL(`${backend}/api/charts/search`);
    searchParams.forEach((v, k) => target.searchParams.set(k, v));

    const r = await fetch(target.toString(), {
      headers: {
        'x-caller-user-id': userId,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(data, { status: r.status });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('[api/charts/search]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
