/**
 * Community Compatibility V1 — comparisons API (Preview surface).
 *
 * - POST /api/comparisons
 *   - Accepts Stage 3 contract (seekerChartId, targetChartId, roles).
 *   - Stamps createdBy from session; caller cannot override ownership.
 *   - Proxies to engine /api/comparisons.
 *
 * - GET /api/comparisons
 *   - Authenticated only.
 *   - Returns comparisons scoped to current session user.
 *   - Anonymous access fails closed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId } from '@/lib/session';

export async function POST(req: NextRequest) {
  const sessionUserId = getSessionUserId(req.cookies);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const backend = getEngineBaseUrl();
    const body = await req.json().catch(() => ({}));
    const backendBody = {
      ...body,
      createdBy: sessionUserId,
    };

    const r = await fetch(`${backend}/api/comparisons`, {
      method: 'POST',
      headers: engineProxyHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(backendBody),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Comparisons unavailable' },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  const sessionUserId = getSessionUserId(req.cookies);
  if (!sessionUserId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const backend = getEngineBaseUrl();
    const url = new URL(`${backend}/api/comparisons`);
    url.searchParams.set('userId', sessionUserId);
    const r = await fetch(url.toString(), {
      method: 'GET',
      headers: engineProxyHeaders({ Accept: 'application/json' }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Comparisons list unavailable' },
      { status: 502 },
    );
  }
}
