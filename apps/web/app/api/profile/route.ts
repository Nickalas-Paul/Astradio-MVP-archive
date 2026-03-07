/**
 * Current user profile. Proxies to engine when ASTRADIO_DEV_USER_ID cookie is set (dev profile flow).
 * When no session: returns { user: null, primaryChart: null } so UI shows create-profile and never a fake chart.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export const dynamic = 'force-dynamic';

const DEV_USER_COOKIE = 'astradio_dev_user_id';

function noSessionResponse() {
  return NextResponse.json({ user: null, primaryChart: null });
}

export async function GET(req: NextRequest) {
  const userId = req.cookies.get(DEV_USER_COOKIE)?.value;
  if (!userId) {
    return noSessionResponse();
  }
  try {
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) {
      if (r.status === 404) {
        const res = noSessionResponse();
        res.cookies.delete(DEV_USER_COOKIE);
        return res;
      }
      const err = await r.json().catch(() => ({}));
      return NextResponse.json(err, { status: r.status });
    }
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e) {
    const res = noSessionResponse();
    res.cookies.delete(DEV_USER_COOKIE);
    return res;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
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
      res.cookies.set(DEV_USER_COOKIE, data.user.id, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Profile create failed' }, { status: 502 });
  }
}
