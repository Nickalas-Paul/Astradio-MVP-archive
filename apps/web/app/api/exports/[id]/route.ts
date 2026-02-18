import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

// Proxy to backend /api/exports/:id (Render). No local filesystem in web app.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const backend = getEngineBaseUrl();
  const { id } = params;
  if (!/^[a-f0-9]{16}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid export ID format' }, { status: 400 });
  }
  try {
    const r = await fetch(`${backend}/api/exports/${id}`);
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return NextResponse.json(data, { status: r.status });
    }
    const contentType = r.headers.get('content-type') || 'audio/mpeg';
    const body = await r.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Export unavailable' }, { status: 502 });
  }
}
