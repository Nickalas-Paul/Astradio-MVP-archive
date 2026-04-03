/**
 * Test / QA only: re-attach session cookie for an existing userId.
 * Gated by ENABLE_TEST_SESSION_RESUME=1. Verifies user exists on engine before setting cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  LEGACY_COOKIE_NAME,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_TEST_SESSION_RESUME !== '1') {
    return NextResponse.json({ error: 'Test session resume is not enabled' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }
  try {
    const base = getEngineBaseUrl();
    const r = await fetch(`${base}/api/profile?userId=${encodeURIComponent(userId)}`);
    if (r.status === 404) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return NextResponse.json(
        { error: typeof err.error === 'string' ? err.error : `profile_check_failed_${r.status}` },
        { status: r.status }
      );
    }
    const res = NextResponse.json({ ok: true, userId });
    try {
      res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(userId), SESSION_COOKIE_OPTIONS);
    } catch {
      res.cookies.set(LEGACY_COOKIE_NAME, userId, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'resume_failed' },
      { status: 502 }
    );
  }
}
