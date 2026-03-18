/**
 * Proxy to engine for Phase 4A/6 sandbox routes.
 * POST -> /api/sandbox/{path}. GET -> /api/sandbox/compositions (list) or /api/sandbox/compositions/:id.
 * Stage 6: for compositions routes only, forward session userId so engine can enforce owner isolation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { getSessionUserId } from '@/lib/session';

function isCompositionsRoute(pathStr: string): boolean {
  return pathStr === 'compositions' || pathStr.startsWith('compositions/');
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const backend = getEngineBaseUrl();
    const body = await req.json().catch(() => ({}));
    const url = new URL(`${backend}/api/sandbox/${pathStr}`);
    if (isCompositionsRoute(pathStr)) {
      const userId = getSessionUserId(req.cookies);
      if (userId) url.searchParams.set('userId', userId);
    }
    const r = await fetch(url.toString(), {
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    if (!pathStr.startsWith('compositions')) {
      return NextResponse.json(
        { error: 'Method not allowed. Use GET /api/sandbox/compositions or GET /api/sandbox/compositions/:id.' },
        { status: 405 }
      );
    }
    const backend = getEngineBaseUrl();
    const url = new URL(req.url);
    const targetUrl = new URL(`${backend}/api/sandbox/${pathStr}`);
    url.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));
    if (isCompositionsRoute(pathStr)) {
      const userId = getSessionUserId(req.cookies);
      if (userId) targetUrl.searchParams.set('userId', userId);
    }
    const r = await fetch(targetUrl.toString());
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
    console.error('[api/sandbox] proxy GET error:', message);
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
