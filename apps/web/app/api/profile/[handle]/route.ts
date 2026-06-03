/**
 * Profile by handle. Proxies GET to engine /api/profile/:handle.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;
    if (!handle) return NextResponse.json({ error: 'handle required' }, { status: 400 });
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile/${encodeURIComponent(handle)}`, {
      headers: engineProxyHeaders(),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Profile fetch failed' },
      { status: 502 }
    );
  }
}
