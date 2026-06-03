/**
 * Proxy avatar image bytes from engine (S3-backed when bucket is private).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';

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
    const r = await fetch(`${base}/api/profile/avatar/${encodeURIComponent(userId.trim())}`, {
      headers: engineProxyHeaders(),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return NextResponse.json(data, { status: r.status });
    }
    const contentType = r.headers.get('content-type') || 'image/jpeg';
    const body = await r.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Avatar unavailable' }, { status: 502 });
  }
}
