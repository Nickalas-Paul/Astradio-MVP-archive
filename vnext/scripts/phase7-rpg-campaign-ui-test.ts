#!/usr/bin/env node
/**
 * Phase 7 Slice 5.5 — RPG campaign UI view tests.
 *
 * Verifies:
 * - Campaign view builder is stable (canonical JSON) across repeated calls.
 * - Character sheet section contains expected keys.
 * - Current turn section reflects submitted response and turn IDs.
 * - Outcome section reflects updated chapter and domain weights.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import type { EphemerisSnapshot } from '../contracts';
import { initialCampaignState } from '../rpg/campaign/state-machine';
import {
  getOrCreateRpgProfileForChart,
  getOrCreateCampaign,
} from '../rpg/store/rpg-store';
import { getOrCreateDailyTurn } from '../rpg/campaign/turn-service';
import { submitResponse, finalizeTurnOutcome } from '../rpg/campaign/response-service';
import { buildCampaignView } from '../rpg/campaign/view';
import { canonicalJsonString } from '../rpg/hash/json-hash';
import { getTestRunTag, deriveDeterministicDay } from './_test-run-tag';

const POSTGRES_URL = process.env.POSTGRES_URL;
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

async function main(): Promise<void> {
  if (!POSTGRES_URL) {
    if (IS_CI) {
      // eslint-disable-next-line no-console
      console.error('FAIL: POSTGRES_URL not set in CI');
      process.exit(1);
    } else {
      log('SKIP: POSTGRES_URL not set');
      return;
    }
  }

  const pool = new Pool({ connectionString: POSTGRES_URL });

  const mig007 = path.join(process.cwd(), 'migrations', '007_phase7_rpg_bundles_profiles.sql');
  const mig008 = path.join(process.cwd(), 'migrations', '008_phase7_rpg_campaigns.sql');
  await pool.query(fs.readFileSync(mig007, 'utf8'));
  await pool.query(fs.readFileSync(mig008, 'utf8'));

  const tag = getTestRunTag('phase7-rpg-campaign-ui-test');
  const userId = `user_test_ui_${tag}`;
  const chartId = `chart_test_ui_${tag}`;

  // Scoped cleanup: remove any rows for this script/tag namespace so reruns
  // remain idempotent without touching other data.
  async function cleanupNamespace(): Promise<void> {
    const campaignsRes = await pool.query(
      `SELECT id FROM rpg_campaigns WHERE user_id = $1 AND chart_id = $2`,
      [userId, chartId]
    );
    const campaignIds = campaignsRes.rows.map((r: any) => r.id as string);
    if (campaignIds.length === 0) {
      await pool.query(`DELETE FROM rpg_profiles WHERE user_id = $1 AND chart_id = $2`, [userId, chartId]);
      return;
    }

    const turnsRes = await pool.query(
      `SELECT id FROM rpg_daily_turns WHERE campaign_id = ANY($1::text[])`,
      [campaignIds]
    );
    const turnIds = turnsRes.rows.map((r: any) => r.id as string);

    if (turnIds.length > 0) {
      await pool.query(`DELETE FROM rpg_daily_audio_artifacts WHERE turn_id = ANY($1::text[])`, [turnIds]);
      await pool.query(`DELETE FROM rpg_turn_outcomes WHERE turn_id = ANY($1::text[])`, [turnIds]);
      await pool.query(`DELETE FROM rpg_member_responses WHERE turn_id = ANY($1::text[])`, [turnIds]);
      await pool.query(`DELETE FROM rpg_daily_turns WHERE id = ANY($1::text[])`, [turnIds]);
    }

    await pool.query(`DELETE FROM rpg_campaigns WHERE id = ANY($1::text[])`, [campaignIds]);
    await pool.query(`DELETE FROM rpg_profiles WHERE user_id = $1 AND chart_id = $2`, [userId, chartId]);
  }

  await cleanupNamespace();

  const natalSnapshot: EphemerisSnapshot = {
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

  const profile = await getOrCreateRpgProfileForChart({ userId, chartId, snapshot: natalSnapshot });
  const initialState = initialCampaignState(
    // We don't need the full bundle contents here; state-machine only uses domainSummary.
    // Fetch via profile path (will recompute deterministically from snapshot).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../rpg/effects/bundle-from-snapshot')?.buildRpgEffectsBundleFromSnapshot(natalSnapshot)
  );

  const campaign = await getOrCreateCampaign({
    userId,
    chartId,
    bundleHash: profile.bundle_hash,
    rpgMapVersion: profile.rpg_map_version,
    rpgAlgoVersion: 'rpg-v1',
    audioAlgoVersion: 'audio-v1',
    initialStateJson: initialState,
  });

  // Derive a deterministic, slice-tagged transit timestamp to avoid turn_seed
  // collisions with other slices while remaining reproducible for a given tag.
  const day = deriveDeterministicDay({
    tag,
    salt: 'phase7-rpg-campaign-ui-test',
    minDay: 1,
    maxDay: 28,
  });
  const transitTs = `2026-03-${String(day).padStart(2, '0')}T12:00:00Z`;

  const transitSnapshot: EphemerisSnapshot = {
    ts: transitTs,
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

  const turn = await getOrCreateDailyTurn({
    campaignId: campaign.id,
    transitSnapshot,
    stateJson: campaign.state_json,
  });

  const prompt = turn.prompt_spec_json as any;
  const choiceId: string = Array.isArray(prompt.choice_ids) ? prompt.choice_ids[0] : '';
  await submitResponse({ turnId: turn.id, userId, choiceId });
  await finalizeTurnOutcome({ turnId: turn.id });

  const view1 = await buildCampaignView({ campaignId: campaign.id, userId });
  const view2 = await buildCampaignView({ campaignId: campaign.id, userId });

  const json1 = canonicalJsonString(view1);
  const json2 = canonicalJsonString(view2);

  if (json1 !== json2) {
    // eslint-disable-next-line no-console
    console.error('FAIL: Campaign view payload is not stable across repeated calls');
    process.exitCode = 1;
  } else {
    log('✓ Campaign view payload is stable across repeated calls');
  }

  if (!view1.character_sheet.class_slug || !view1.character_sheet.subclass_slug) {
    // eslint-disable-next-line no-console
    console.error('FAIL: Character sheet missing class/subclass slugs');
    process.exitCode = 1;
  } else {
    log('✓ Character sheet contains class/subclass slugs');
  }

  if (!view1.current_turn || view1.current_turn.turn_seed !== turn.turn_seed) {
    // eslint-disable-next-line no-console
    console.error('FAIL: Current turn view missing or mismatched id');
    process.exitCode = 1;
  } else if (!view1.current_turn.has_responded || view1.current_turn.selected_choice_id !== choiceId) {
    // eslint-disable-next-line no-console
    console.error('FAIL: Current turn view does not reflect submitted response');
    process.exitCode = 1;
  } else {
    log('✓ Current turn view reflects submitted response');
  }

  if (!view1.outcome || !Array.isArray(view1.outcome.top_domains)) {
    // eslint-disable-next-line no-console
    console.error('FAIL: Outcome view missing or has no top_domains');
    process.exitCode = 1;
  } else {
    log('✓ Outcome view contains top_domains');
  }

  await pool.end();

  if (process.exitCode && process.exitCode !== 0) {
    // eslint-disable-next-line no-console
    console.error('\n❌ Phase 7 RPG campaign UI tests failed');
    process.exit(process.exitCode);
  } else {
    log('\n✅ Phase 7 RPG campaign UI tests passed');
  }
}

main().catch((e) => {
  const refused =
    (e as any).code === 'ECONNREFUSED' ||
    ((e as any).errors && (e as any).errors[0]?.code === 'ECONNREFUSED') ||
    (e as any).message?.includes('ECONNREFUSED');
  if (refused) {
    if (IS_CI) {
      // eslint-disable-next-line no-console
      console.error('FAIL: database not available (connection refused) in CI');
      process.exit(1);
    } else {
      // eslint-disable-next-line no-console
      console.log('SKIP: database not available (connection refused)');
      process.exit(0);
    }
  }
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

