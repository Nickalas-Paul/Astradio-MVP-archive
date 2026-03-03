#!/usr/bin/env node
/**
 * Phase 7 Slice 5 — RPG campaign engine tests.
 *
 * Verifies:
 * - Campaign creation is idempotent.
 * - Daily turn creation is idempotent by turn_seed.
 * - Response submission enforces UNIQUE(turn_id, user_id).
 * - Outcome finalization is idempotent.
 * - Campaign state hash changes deterministically after outcome.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { EphemerisSnapshot } from '../contracts';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { initialCampaignState } from '../rpg/campaign/state-machine';
import {
  getOrCreateRpgProfileForChart,
  getOrCreateCampaign,
  getCampaignById,
} from '../rpg/store/rpg-store';
import { getOrCreateDailyTurn } from '../rpg/campaign/turn-service';
import { submitResponse, finalizeTurnOutcome } from '../rpg/campaign/response-service';

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

  const userId = `user_test_${crypto.randomBytes(4).toString('hex')}`;
  const chartId = `chart_test_${crypto.randomBytes(4).toString('hex')}`;

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
  const bundle = buildRpgEffectsBundleFromSnapshot(natalSnapshot);
  const initialState = initialCampaignState(bundle);

  const campaign1 = await getOrCreateCampaign({
    userId,
    chartId,
    bundleHash: profile.bundle_hash,
    rpgMapVersion: profile.rpg_map_version,
    rpgAlgoVersion: 'rpg-v1',
    audioAlgoVersion: 'audio-v1',
    initialStateJson: initialState,
  });
  const campaign2 = await getOrCreateCampaign({
    userId,
    chartId,
    bundleHash: profile.bundle_hash,
    rpgMapVersion: profile.rpg_map_version,
    rpgAlgoVersion: 'rpg-v1',
    audioAlgoVersion: 'audio-v1',
    initialStateJson: initialState,
  });

  if (campaign1.id !== campaign2.id) {
    // eslint-disable-next-line no-console
    console.error('FAIL: campaign creation is not idempotent');
    process.exitCode = 1;
  } else {
    log('✓ Campaign creation is idempotent');
  }

  const transitSnapshot: EphemerisSnapshot = {
    ts: '2026-03-03T12:00:00Z',
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

  const turn1 = await getOrCreateDailyTurn({
    campaignId: campaign1.id,
    transitSnapshot,
    stateJson: campaign1.state_json,
  });
  const turn2 = await getOrCreateDailyTurn({
    campaignId: campaign1.id,
    transitSnapshot,
    stateJson: campaign1.state_json,
  });

  if (turn1.id !== turn2.id) {
    // eslint-disable-next-line no-console
    console.error('FAIL: daily turn creation is not idempotent by turn_seed');
    process.exitCode = 1;
  } else {
    log('✓ Daily turn creation is idempotent by turn_seed');
  }

  const prompt = turn1.prompt_spec_json as any;
  const choiceId: string = Array.isArray(prompt.choice_ids) ? prompt.choice_ids[0] : '';
  const resp1 = await submitResponse({ turnId: turn1.id, userId, choiceId });
  const resp2 = await submitResponse({ turnId: turn1.id, userId, choiceId });

  if (resp1.id !== resp2.id) {
    // eslint-disable-next-line no-console
    console.error('FAIL: submitResponse did not enforce UNIQUE(turn_id, user_id)');
    process.exitCode = 1;
  } else {
    log('✓ submitResponse enforces UNIQUE(turn_id, user_id)');
  }

  const out1 = await finalizeTurnOutcome({ turnId: turn1.id });
  const out2 = await finalizeTurnOutcome({ turnId: turn1.id });

  if (out1.id !== out2.id) {
    // eslint-disable-next-line no-console
    console.error('FAIL: finalizeTurnOutcome is not idempotent');
    process.exitCode = 1;
  } else {
    log('✓ finalizeTurnOutcome is idempotent');
  }

  const campaignAfter = await getCampaignById(campaign1.id);
  if (!campaignAfter) {
    // eslint-disable-next-line no-console
    console.error('FAIL: campaign not found after outcome');
    process.exitCode = 1;
  } else {
    if (campaignAfter.state_hash === campaign1.state_hash) {
      // eslint-disable-next-line no-console
      console.error('FAIL: state_hash did not change after outcome');
      process.exitCode = 1;
    } else {
      log('✓ state_hash changes deterministically after outcome');
    }
  }

  await pool.end();

  if (process.exitCode && process.exitCode !== 0) {
    // eslint-disable-next-line no-console
    console.error('\n❌ Phase 7 RPG campaign tests failed');
    process.exit(process.exitCode);
  } else {
    log('\n✅ Phase 7 RPG campaign tests passed');
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

