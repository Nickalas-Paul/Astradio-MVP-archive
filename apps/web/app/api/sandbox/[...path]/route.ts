/**
 * Proxy to engine for Phase 4A sandbox routes.
 * Forwards POST to backend /api/sandbox/{path}.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const backend = getEngineBaseUrl();
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${backend}/api/sandbox/${pathStr}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({ error: r.statusText || 'Invalid response' }));
    if (!r.ok) {
      return NextResponse.json(
        { error: (data && typeof data.error === 'string' ? data.error : data) || r.statusText },
        { status: r.status >= 400 ? r.status : 502 }
      );
    }
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Sandbox API unavailable';
    console.error('[api/sandbox] proxy POST error:', message);
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST /api/sandbox/snapshot or POST /api/sandbox/report.' },
    { status: 405 }
  );
}
