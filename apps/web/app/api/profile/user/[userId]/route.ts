/**
 * Profile by user id. Proxies GET to engine /api/profile?userId=
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile?userId=${encodeURIComponent(userId.trim())}`);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Profile fetch failed' },
      { status: 502 }
    );
  }
}
