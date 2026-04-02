/**
 * Proxy to engine for Phase 3A community routes not handled by more specific routes.
 * Forwards GET/POST to backend /api/community/{path}. Does not handle /api/community/search, relational-feed, or groups/profile (those have dedicated routes).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/community/${pathStr}${qs ? `?${qs}` : ''}`);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    console.error('[api/community] proxy GET error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Community API unavailable' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const backend = getEngineBaseUrl();
    const body = await req.json().catch(() => ({}));
    const r = await fetch(`${backend}/api/community/${pathStr}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    console.error('[api/community] proxy POST error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Community API unavailable' },
      { status: 502 }
    );
  }
}
