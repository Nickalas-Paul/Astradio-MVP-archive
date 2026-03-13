/**
 * Phase 8 Stage 5: proxy bootstrap for isolation verification user (phase8_iso_user).
 * Enabled only when PHASE8_DEBUG=1. No writes unless enabled (fail-closed).
 */

import { NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.PHASE8_DEBUG !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const base = getEngineBaseUrl();
    const target = `${base}/api/debug/phase8/create-iso-user`;
    const r = await fetch(target);
    const body = await r.json().catch(() => ({}));
    return NextResponse.json(body, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create Phase 8 isolation user';
    console.error('[api/debug/phase8/create-iso-user] error', msg);
    if (typeof msg === 'string' && /relation\s+"user_profiles"\s+does not exist/i.test(msg)) {
      return NextResponse.json({ error: 'schema_missing:user_profiles' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
