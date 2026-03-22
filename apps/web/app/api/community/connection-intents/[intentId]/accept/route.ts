import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { getSessionUserId } from '@/lib/session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ intentId: string }> }) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    const { intentId } = await params;
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/community/connection-intents/${encodeURIComponent(intentId)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'accept failed' },
      { status: 502 }
    );
  }
}
