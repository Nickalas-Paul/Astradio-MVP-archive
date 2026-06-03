/**
 * Proxies POST /api/auth/register to engine. Does not set session — user verifies email then logs in.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const backend = getEngineBaseUrl();
    const r = await fetch(`${backend}/api/auth/register`, {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Register unavailable' },
      { status: 502 },
    );
  }
}
