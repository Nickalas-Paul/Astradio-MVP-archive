/**
 * Proxy to engine for direct messaging routes.
 * Session-derived userId only: strips client userId from query/body and injects session id (or 401).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

async function proxyGet(req: NextRequest, pathStr: string) {
  const sessionUserId = getSessionUserId(req.cookies);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const url = new URL(req.url);
  url.searchParams.delete('userId');
  url.searchParams.set('userId', sessionUserId);
  const qs = url.searchParams.toString();
  const backend = getEngineBaseUrl();
  const r = await fetch(`${backend}/api/dm/${pathStr}${qs ? `?${qs}` : ''}`, {
    headers: engineProxyHeaders(),
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}

async function proxyPost(req: NextRequest, pathStr: string) {
  const sessionUserId = getSessionUserId(req.cookies);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const backend = getEngineBaseUrl();
  const body = await req.json().catch(() => ({}));
  const payload =
    body && typeof body === 'object' && !Array.isArray(body) ? { ...body } : {};
  delete (payload as Record<string, unknown>).userId;
  (payload as Record<string, unknown>).userId = sessionUserId;

  const r = await fetch(`${backend}/api/dm/${pathStr}`, {
    method: 'POST',
    headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    return proxyGet(req, path.join('/'));
  } catch (e: unknown) {
    console.error('[api/dm] proxy GET error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'DM API unavailable' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    return proxyPost(req, path.join('/'));
  } catch (e: unknown) {
    console.error('[api/dm] proxy POST error:', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'DM API unavailable' },
      { status: 502 }
    );
  }
}
