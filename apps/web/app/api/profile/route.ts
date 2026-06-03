/**
 * Current user profile. Proxies to engine using Session Identity Layer (Phase 8H).
 * When no session: returns { user: null, primaryChart: null }.
 * POST: authenticated chart completion only (proxies to engine /api/profile/user-chart).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';
import { getSessionUserId, SESSION_COOKIE_NAME, LEGACY_COOKIE_NAME } from '@/lib/session';

export const dynamic = 'force-dynamic';

function noSessionResponse() {
  return NextResponse.json({ user: null, primaryChart: null });
}

export async function GET(req: NextRequest) {
  const sessionUserId = getSessionUserId(req.cookies);
  const qsUserId = req.nextUrl.searchParams.get('userId')?.trim() || null;

  let userId = sessionUserId;

  const debugAllowed =
    process.env.NODE_ENV !== 'production' &&
    process.env.PHASE8_DEBUG === '1' &&
    qsUserId;

  if (!userId && debugAllowed) {
    userId = qsUserId;
  }

  if (!userId) {
    return noSessionResponse();
  }
  try {
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile?userId=${encodeURIComponent(userId)}`, {
      headers: engineProxySessionHeaders(userId),
    });
    if (!r.ok) {
      if (r.status === 404) {
        const res = noSessionResponse();
        res.cookies.delete(SESSION_COOKIE_NAME);
        res.cookies.delete(LEGACY_COOKIE_NAME);
        return res;
      }
      const err = await r.json().catch(() => ({}));
      return NextResponse.json(err, { status: r.status });
    }
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e) {
    const res = noSessionResponse();
    res.cookies.delete(SESSION_COOKIE_NAME);
    res.cookies.delete(LEGACY_COOKIE_NAME);
    return res;
  }
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (!process.env.ASTRADIO_SESSION_SECRET || process.env.ASTRADIO_SESSION_SECRET.length < 32) {
    return NextResponse.json(
      { error: 'ASTRADIO_SESSION_SECRET must be set (min 32 chars) for authenticated profile actions' },
      { status: 503 },
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const chart = body?.chart;
    if (!chart || typeof chart !== 'object') {
      return NextResponse.json({ error: 'chart required' }, { status: 400 });
    }
    if (chart.location) {
      const loc = chart.location as Record<string, unknown>;
      if (loc.source !== 'geofinder') {
        return NextResponse.json(
          { error: 'Invalid location source for profile chart. Expected source=geofinder.' },
          { status: 400 },
        );
      }
      if (
        typeof loc.lat !== 'number' ||
        typeof loc.lon !== 'number' ||
        typeof loc.timezone !== 'string' ||
        !Number.isFinite(loc.lat) ||
        !Number.isFinite(loc.lon) ||
        !loc.timezone
      ) {
        return NextResponse.json({ error: 'Invalid canonical location for profile chart' }, { status: 400 });
      }
      body.chart = {
        label: chart.label,
        date: chart.date,
        time: chart.time,
        lat: loc.lat,
        lon: loc.lon,
        timezone: loc.timezone,
      };
    }
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile/user-chart`, {
      method: 'POST',
      headers: engineProxySessionHeaders(userId, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ chart: body.chart }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Profile chart save failed' }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const patchBody =
      body && typeof body === 'object' && !Array.isArray(body)
        ? { ...(body as Record<string, unknown>) }
        : {};
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile`, {
      method: 'PATCH',
      headers: engineProxySessionHeaders(userId, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(patchBody),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Profile update failed' }, { status: 502 });
  }
}
