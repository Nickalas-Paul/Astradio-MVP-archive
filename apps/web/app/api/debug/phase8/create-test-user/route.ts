/**
 * Phase 8 debug-only: create a real test user profile + natal snapshot via Swiss, bundle, campaign, and one daily turn.
 * Enabled only when PHASE8_DEBUG=1. No writes unless enabled (fail-closed).
 */

import { NextResponse } from 'next/server';
import { getOrCreatePhase8RealUserCampaign } from '../../../../../../../vnext/phase8/resolve-real-user-campaign';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.PHASE8_DEBUG !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!process.env.POSTGRES_URL) {
    return NextResponse.json({ error: 'db_unconfigured' }, { status: 503 });
  }

  try {
    const { userId, campaignId } = await getOrCreatePhase8RealUserCampaign();
    return NextResponse.json({
      userId,
      campaignId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create Phase 8 test user';
    // eslint-disable-next-line no-console
    console.error('[api/debug/phase8/create-test-user] error:', msg, e);
    // Classify missing table so operators know schema was not applied (e.g. migration not run on Preview DB).
    if (typeof msg === 'string' && /relation\s+"user_profiles"\s+does not exist/i.test(msg)) {
      return NextResponse.json({ error: 'schema_missing:user_profiles' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

