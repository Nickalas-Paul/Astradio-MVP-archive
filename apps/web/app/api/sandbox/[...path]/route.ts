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
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    console.error('[api/sandbox] proxy POST error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Sandbox API unavailable' },
      { status: 502 }
    );
  }
}
