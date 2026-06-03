import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';

/** Lightweight existence check — no WAV body (pair with GET in ValidatedExportAudioPlayer). */
export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const backend = getEngineBaseUrl();
  const { id } = await params;
  if (!/^[a-f0-9]{64}$/.test(id)) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const r = await fetch(`${backend}/api/exports/${id}`, {
      method: 'HEAD',
      headers: engineProxyHeaders(),
    });
    return new NextResponse(null, { status: r.status });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}

// Proxy to backend /api/exports/:id (Render). No local filesystem in web app.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const backend = getEngineBaseUrl();
  const { id } = params;
  if (!/^[a-f0-9]{64}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid export ID format' }, { status: 400 });
  }
  try {
    const r = await fetch(`${backend}/api/exports/${id}`, { headers: engineProxyHeaders() });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return NextResponse.json(data, { status: r.status });
    }
    const contentType = r.headers.get('content-type') || 'audio/mpeg';
    const body = await r.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: engineProxyHeaders({ 'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000' }),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Export unavailable' }, { status: 502 });
  }
}
