/**
 * Proxy to engine GET /api/user/history (export dir list).
 * Phase 8H: forwards x-beta-user from session identity (signed cookie or legacy fallback).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { getSessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const backend = getEngineBaseUrl();
    const url = new URL(req.url);
    const query = url.searchParams.toString();
    const headers: Record<string, string> = {};
    const betaUser = getSessionUserId(req.cookies) ?? '';
    if (betaUser) {
      headers['x-beta-user'] = betaUser;
    }
    const r = await fetch(`${backend}/api/user/history${query ? `?${query}` : ''}`, { headers });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return NextResponse.json(
        typeof data === 'object' && data !== null ? data : { error: r.statusText },
        { status: r.status >= 400 ? r.status : 502 }
      );
    }
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'User history unavailable';
    console.error('[api/user/history] proxy error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
