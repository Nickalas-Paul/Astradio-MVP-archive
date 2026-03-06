/**
 * Phase 8 debug-only: idempotent get-or-create a test campaign + one daily turn.
 * Enabled only when PHASE8_DEBUG=1. No writes unless enabled (fail-closed).
 */

import { NextResponse } from 'next/server';
import type { EphemerisSnapshot } from '../../../../../../../../../vnext/contracts';
import {
  getOrCreateRpgProfileForChart,
  getOrCreateCampaign,
} from '../../../../../../../../../vnext/rpg/store/rpg-store';
import { initialCampaignState } from '../../../../../../../../../vnext/rpg/campaign/state-machine';
import { buildRpgEffectsBundleFromSnapshot } from '../../../../../../../../../vnext/rpg/effects/bundle-from-snapshot';
import { getOrCreateDailyTurn } from '../../../../../../../../../vnext/rpg/campaign/turn-service';

export const runtime = 'nodejs';

const PHASE8_PREVIEW_USER_ID = 'phase8_preview';
const PHASE8_PREVIEW_CHART_ID = 'phase8_preview';

/** Known natal snapshot (deterministic); same shape as phase8-rpg-lifecycle-proof. */
function getPhase8PreviewNatalSnapshot(): EphemerisSnapshot {
  return {
    ts: '1990-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 45 },
      { name: 'Mercury', lon: 60 },
      { name: 'Venus', lon: 75 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 120 },
      { name: 'Uranus', lon: 135 },
      { name: 'Neptune', lon: 150 },
      { name: 'Pluto', lon: 165 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

/** Deterministic transit snapshot for the one daily turn. */
function getPhase8PreviewTransitSnapshot(): EphemerisSnapshot {
  return {
    ts: '2036-03-15T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 195 },
      { name: 'Mercury', lon: 30 },
      { name: 'Venus', lon: 210 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 300 },
      { name: 'Uranus', lon: 120 },
      { name: 'Neptune', lon: 330 },
      { name: 'Pluto', lon: 270 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [
      { a: 'Sun', b: 'Saturn', type: 'square', orb: 2 },
      { a: 'Moon', b: 'Uranus', type: 'conjunction', orb: 1.5 },
      { a: 'Venus', b: 'Neptune', type: 'trine', orb: 3 },
    ],
    moonPhase: 0.7,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

export async function GET() {
  if (process.env.PHASE8_DEBUG !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!process.env.POSTGRES_URL) {
    return NextResponse.json({ error: 'db_unconfigured' }, { status: 503 });
  }

  try {
    const natalSnapshot = getPhase8PreviewNatalSnapshot();
    const profile = await getOrCreateRpgProfileForChart({
      userId: PHASE8_PREVIEW_USER_ID,
      chartId: PHASE8_PREVIEW_CHART_ID,
      snapshot: natalSnapshot,
    });

    const bundle = buildRpgEffectsBundleFromSnapshot(natalSnapshot);
    const initialState = initialCampaignState(bundle);

    const campaign = await getOrCreateCampaign({
      userId: PHASE8_PREVIEW_USER_ID,
      chartId: PHASE8_PREVIEW_CHART_ID,
      bundleHash: profile.bundle_hash,
      rpgMapVersion: profile.rpg_map_version,
      rpgAlgoVersion: 'rpg-v1',
      audioAlgoVersion: 'audio-v1',
      initialStateJson: initialState,
    });

    const transitSnapshot = getPhase8PreviewTransitSnapshot();
    await getOrCreateDailyTurn({
      campaignId: campaign.id,
      transitSnapshot,
      stateJson: campaign.state_json,
    });

    return NextResponse.json({
      campaignId: campaign.id,
      userId: campaign.user_id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to seed campaign';
    console.error('[api/debug/phase8/seed-campaign] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
