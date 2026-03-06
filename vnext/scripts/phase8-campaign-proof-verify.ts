#!/usr/bin/env node
/**
 * Phase 8 — Campaign proof verification.
 *
 * Ensures stored-data → daily challenge pipeline is provable:
 * - Seeds or reuses the phase8_preview test campaign (idempotent).
 * - Builds campaign view and asserts character_sheet is present.
 * - Asserts either current_turn is present or _diagnostics indicates no daily turn (no silent blank).
 *
 * Run with POSTGRES_URL set. In CI, script exits 1 if POSTGRES_URL is missing.
 */

import 'dotenv/config';
import type { EphemerisSnapshot } from '../contracts';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { initialCampaignState } from '../rpg/campaign/state-machine';
import {
  getOrCreateRpgProfileForChart,
  getOrCreateCampaign,
} from '../rpg/store/rpg-store';
import { getOrCreateDailyTurn } from '../rpg/campaign/turn-service';
import { buildCampaignView } from '../rpg/campaign/view';

const POSTGRES_URL = process.env.POSTGRES_URL;
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

const PHASE8_PREVIEW_USER_ID = 'phase8_preview';
const PHASE8_PREVIEW_CHART_ID = 'phase8_preview';

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

async function main(): Promise<void> {
  if (!POSTGRES_URL) {
    if (IS_CI) {
      console.error('FAIL: POSTGRES_URL not set in CI');
      process.exit(1);
    }
    console.log('SKIP: POSTGRES_URL not set');
    return;
  }

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

  const view = await buildCampaignView({
    campaignId: campaign.id,
    userId: campaign.user_id,
  });

  if (!view.character_sheet || typeof view.character_sheet.class_slug !== 'string') {
    console.error('FAIL: campaign view missing character_sheet or class_slug');
    process.exit(1);
  }

  const hasTurn = view.current_turn != null;
  const hasNoTurnReason = Boolean(view._diagnostics?.no_turn_reason);
  if (!hasTurn && !hasNoTurnReason) {
    console.error(
      'FAIL: no current_turn and no _diagnostics.no_turn_reason (silent missing turn)'
    );
    process.exit(1);
  }

  console.log(
    '[phase8-campaign-proof-verify] character_sheet present, turn or no_turn_reason present'
  );
  console.log('Phase 8 campaign proof verification passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
