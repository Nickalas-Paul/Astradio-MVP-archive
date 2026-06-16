/**
 * Proxy to engine for Phase 3A community routes not handled by more specific routes.
 * Session-derived userId only: strips client userId from query/body and injects session id (or 401).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

function isPublicCommunityGetPath(pathStr: string): boolean {
  return pathStr === 'guidance' || pathStr.startsWith('guidance/');
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    if (isPublicCommunityGetPath(pathStr)) {
      const { searchParams } = new URL(req.url);
      const qs = searchParams.toString();
      const backend = getEngineBaseUrl();
      const r = await fetch(`${backend}/api/community/${pathStr}${qs ? `?${qs}` : ''}`, { headers: engineProxyHeaders() });
      const data = await r.json().catch(() => ({}));
      return NextResponse.json(data, { status: r.status });
    }

    const sessionUserId = getSessionUserId(req.cookies);
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const url = new URL(req.url);
    url.searchParams.delete('userId');
    url.searchParams.set('userId', sessionUserId);
    const qs = url.searchParams.toString();
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/community/${pathStr}${qs ? `?${qs}` : ''}`, { headers: engineProxyHeaders() });
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
    const sessionUserId = getSessionUserId(req.cookies);
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { path } = await params;
    const pathStr = path.join('/');
    const backend = getEngineBaseUrl();
    const body = await req.json().catch(() => ({}));
    const payload =
      body && typeof body === 'object' && !Array.isArray(body)
        ? { ...body }
        : {};
    delete (payload as Record<string, unknown>).userId;
    (payload as Record<string, unknown>).userId = sessionUserId;

    const r = await fetch(`${backend}/api/community/${pathStr}`, {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
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

async function proxyWithSession(
  req: NextRequest,
  pathStr: string,
  method: 'PUT' | 'DELETE'
): Promise<NextResponse> {
  const sessionUserId = getSessionUserId(req.cookies);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const backend = getEngineBaseUrl();
  const body = method === 'DELETE' ? {} : await req.json().catch(() => ({}));
  const payload =
    body && typeof body === 'object' && !Array.isArray(body) ? { ...body } : {};
  delete (payload as Record<string, unknown>).userId;
  (payload as Record<string, unknown>).userId = sessionUserId;
  const r = await fetch(`${backend}/api/community/${pathStr}`, {
    method,
    headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  return NextResponse.json(data, { status: r.status });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    return proxyWithSession(req, path.join('/'), 'PUT');
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Community API unavailable' },
      { status: 502 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    return proxyWithSession(req, path.join('/'), 'DELETE');
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Community API unavailable' },
      { status: 502 }
    );
  }
}
