/**
 * Phase 8 debug-only: create a real test user profile + natal snapshot via Swiss, bundle, and campaign.
 * Enabled only when PHASE8_DEBUG=1. No writes unless enabled (fail-closed).
 */

import { NextResponse } from 'next/server';
import type { EphemerisSnapshot } from '../../../../../../../../../vnext/contracts';
import { generateNatalSnapshot } from '../../../../../../../../../vnext/phase8/generate-natal-snapshot';
import {
  getOrCreateRpgProfileForChart,
  getOrCreateCampaign,
  upsertUserProfileForPhase8,
} from '../../../../../../../../../vnext/rpg/store/rpg-store';
import { initialCampaignState } from '../../../../../../../../../vnext/rpg/campaign/state-machine';
import { buildRpgEffectsBundleFromSnapshot } from '../../../../../../../../../vnext/rpg/effects/bundle-from-snapshot';

export const runtime = 'nodejs';

const PHASE8_USER_ID = 'phase8_real_user';
const PHASE8_CHART_ID = 'phase8_real_chart';

// Deterministic birth data for the Phase 8 test user.
const BIRTH_DATE = '1990-01-01';
const BIRTH_TIME = '12:00';
const BIRTH_LOCATION = 'New York, NY, USA';
const BIRTH_LAT = 40.7128;
const BIRTH_LON = -74.006;

async function generatePhase8NatalSnapshot(): Promise<EphemerisSnapshot> {
  return generateNatalSnapshot({
    birth_date: BIRTH_DATE,
    birth_time: BIRTH_TIME,
    birth_location: BIRTH_LOCATION,
    lat: BIRTH_LAT,
    lon: BIRTH_LON,
    timezone: 'America/New_York',
  });
}

export async function GET() {
  if (process.env.PHASE8_DEBUG !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!process.env.POSTGRES_URL) {
    return NextResponse.json({ error: 'db_unconfigured' }, { status: 503 });
  }

  try {
    const natalSnapshot = await generatePhase8NatalSnapshot();

    const profile = await getOrCreateRpgProfileForChart({
      userId: PHASE8_USER_ID,
      chartId: PHASE8_CHART_ID,
      snapshot: natalSnapshot,
    });

    const bundle = buildRpgEffectsBundleFromSnapshot(natalSnapshot);
    const initialState = initialCampaignState(bundle);

    await upsertUserProfileForPhase8({
      userId: PHASE8_USER_ID,
      chartId: PHASE8_CHART_ID,
      birthDate: BIRTH_DATE,
      birthTime: BIRTH_TIME,
      birthLocation: BIRTH_LOCATION,
      natalSnapshotHash: profile.natal_snapshot_hash,
      bundleHash: profile.bundle_hash,
    });

    const campaign = await getOrCreateCampaign({
      userId: PHASE8_USER_ID,
      chartId: PHASE8_CHART_ID,
      bundleHash: profile.bundle_hash,
      rpgMapVersion: profile.rpg_map_version,
      rpgAlgoVersion: 'rpg-v1',
      audioAlgoVersion: 'audio-v1',
      initialStateJson: initialState,
    });

    return NextResponse.json({
      userId: PHASE8_USER_ID,
      campaignId: campaign.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create Phase 8 test user';
    // eslint-disable-next-line no-console
    console.error('[api/debug/phase8/create-test-user] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

