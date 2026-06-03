/**
 * Phase 8 debug-only: proxy bootstrap to engine.
 * Enabled only when PHASE8_DEBUG=1. No writes unless enabled (fail-closed).
 */

import { NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';

export const runtime = 'nodejs';
// Phase 8 debug-only; force dynamic so Vercel/Next never tries to statically generate this route at build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  // eslint-disable-next-line no-console
  console.log('[api/debug/phase8/create-test-user] enter', {
    phase8Debug: process.env.PHASE8_DEBUG === '1',
    hasPostgresUrl: !!process.env.POSTGRES_URL,
  });

  if (process.env.PHASE8_DEBUG !== '1') {
    // eslint-disable-next-line no-console
    console.log('[api/debug/phase8/create-test-user] skip', {
      reason: 'PHASE8_DEBUG!=1',
    });
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const base = getEngineBaseUrl();
    const target = `${base}/api/debug/phase8/create-test-user`;
    // eslint-disable-next-line no-console
    console.log('[api/debug/phase8/create-test-user] proxy -> engine', {
      target,
    });
    const r = await fetch(target, { headers: engineProxyHeaders() });
    const body = await r.json().catch(() => ({}));
    // eslint-disable-next-line no-console
    console.log('[api/debug/phase8/create-test-user] engine response', {
      status: r.status,
    });
    return NextResponse.json(body, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create Phase 8 test user';
    // eslint-disable-next-line no-console
    console.error('[api/debug/phase8/create-test-user] error', {
      message: msg,
    });
    // Classify missing table so operators know schema was not applied (e.g. migration not run on Preview DB).
    if (typeof msg === 'string' && /relation\s+"user_profiles"\s+does not exist/i.test(msg)) {
      return NextResponse.json({ error: 'schema_missing:user_profiles' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

