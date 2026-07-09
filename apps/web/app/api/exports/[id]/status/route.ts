import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders } from '@/lib/engine-proxy-headers';

/** Poll export readiness (WAV/MP4) — small JSON, safe through Vercel proxy. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const backend = getEngineBaseUrl();
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid export ID format' }, { status: 400 });
  }
  try {
    const r = await fetch(`${backend}/api/exports/${id}/status`, {
      headers: engineProxyHeaders(),
      cache: 'no-store',
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Export status unavailable';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
