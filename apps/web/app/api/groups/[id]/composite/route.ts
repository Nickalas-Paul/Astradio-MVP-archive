import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { getSessionUserId } from '@/lib/session';

async function run(req: NextRequest, method: 'GET' | 'POST', id: string, userId: string) {
  const backend = getEngineBaseUrl();
  const url = new URL(`${backend}/api/groups/${id}/composite`);
  url.searchParams.set('userId', userId);
  const r = await fetch(url.toString(), { method, headers: { Accept: 'application/json' } });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const { id } = await params;
    return await run(req, 'GET', id, userId);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Group composite unavailable' },
      { status: 502 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const { id } = await params;
    return await run(req, 'POST', id, userId);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Group composite unavailable' },
      { status: 502 }
    );
  }
}
