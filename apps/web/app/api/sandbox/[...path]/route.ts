/**
 * Proxy to engine for sandbox API routes (compose lab).
 * POST -> /api/sandbox/{path}. GET -> /api/sandbox/compositions (list) or /api/sandbox/compositions/:id.
 * For compositions routes only, forwards session userId so the engine can enforce per-owner persistence isolation.
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

function isCompositionsRoute(pathStr: string): boolean {
  return pathStr === 'compositions' || pathStr.startsWith('compositions/');
}

/** Pass engine JSON through unchanged on errors (preserve `code`, `ok`, `error`, `message`, etc.). */
function jsonResponseForUpstreamError(status: number, data: unknown, statusText: string): NextResponse {
  const httpStatus = status >= 400 ? status : 502;
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return NextResponse.json(data, { status: httpStatus });
  }
  return NextResponse.json({ error: statusText || 'Bad gateway' }, { status: httpStatus });
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
      headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({ error: r.statusText || 'Invalid response' }));
    if (!r.ok) {
      return jsonResponseForUpstreamError(r.status, data, r.statusText);
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
    const r = await fetch(targetUrl.toString(), { headers: engineProxyHeaders() });
    const data = await r.json().catch(() => ({ error: r.statusText || 'Invalid response' }));
    if (!r.ok) {
      return jsonResponseForUpstreamError(r.status, data, r.statusText);
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
