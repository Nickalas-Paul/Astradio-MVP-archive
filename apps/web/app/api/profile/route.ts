/**
 * Current user profile. Proxies to engine using Session Identity Layer (Phase 8H).
 * When no session: returns { user: null, primaryChart: null } so UI shows create-profile and never a fake chart.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import {
  getSessionUserId,
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  LEGACY_COOKIE_NAME,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

function noSessionResponse() {
  return NextResponse.json({ user: null, primaryChart: null });
}

export async function GET(req: NextRequest) {
  const sessionUserId = getSessionUserId(req.cookies);
  const qsUserId = req.nextUrl.searchParams.get('userId')?.trim() || null;

  let userId = sessionUserId;

  // Phase 8H / dev-only fallback: when there is no session but a userId query
  // is provided and PHASE8_DEBUG is enabled, allow explicit identity override
  // for verification scripts. This path never sets or clears cookies.
  if (!userId && qsUserId && process.env.PHASE8_DEBUG === '1') {
    userId = qsUserId;
  }

  if (!userId) {
    return noSessionResponse();
  }
  try {
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile?userId=${encodeURIComponent(userId)}`);
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
  try {
    const body = await req.json().catch(() => ({}));
    const chart = body?.chart;
    if (chart && chart.location) {
      const loc = chart.location as any;
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
        return NextResponse.json(
          { error: 'Invalid canonical location for profile chart' },
          { status: 400 },
        );
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
    const r = await fetch(`${base}/api/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    const res = NextResponse.json(data, { status: 201 });
    if (data?.user?.id) {
      try {
        res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(data.user.id), SESSION_COOKIE_OPTIONS);
      } catch {
        // No ASTRADIO_SESSION_SECRET: set legacy cookie so identity still persists (no breaking change)
        res.cookies.set(LEGACY_COOKIE_NAME, data.user.id, { path: '/', maxAge: 60 * 60 * 24 * 365 });
      }
    }
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Profile create failed' }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = getSessionUserId(req.cookies);
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, userId }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(data, { status: r.status });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Profile update failed' }, { status: 502 });
  }
}
