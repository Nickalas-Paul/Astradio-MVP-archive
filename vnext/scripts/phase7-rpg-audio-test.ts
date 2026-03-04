#!/usr/bin/env node
/**
 * Phase 7 Slice 6 — RPG daily audio rails tests.
 *
 * Verifies:
 * - makeAudioSeedFromTurnSeed is deterministic and sensitive.
 * - DB: audio artifact rows are idempotent by turn_seed (UNIQUE).
 * - DB: status starts as pending, provider defaults to none.
 *
 * CI behavior:
 * - If CI=true and DB unavailable or POSTGRES_URL missing, FAIL.
 * - If not CI, skip when DB unavailable for developer convenience.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { EphemerisSnapshot } from '../contracts';
import { makeAudioSeedFromTurnSeed } from '../rpg/hash/seeds';
import type { AudioAlgoVersion, TurnSeed } from '../rpg/contracts';
import { getOrCreateRpgProfileForChart, getOrCreateCampaign } from '../rpg/store/rpg-store';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { initialCampaignState } from '../rpg/campaign/state-machine';
import { getOrCreateDailyTurn } from '../rpg/campaign/turn-service';
import { getOrCreateDailyAudioArtifact } from '../rpg/campaign/audio-service';

const POSTGRES_URL = process.env.POSTGRES_URL;
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

function seedTests(): void {
  const algo = 'audio-v1' as AudioAlgoVersion;
  const turnSeedA = 'aaaabbbbccccddddeeeeffff1111222233334444555566667777888899990000' as TurnSeed;
  const turnSeedB = 'bbbbccccddddeeeeffff1111222233334444555566667777888899990000aaaa' as TurnSeed;

  const s1 = makeAudioSeedFromTurnSeed(turnSeedA, algo);
  const s2 = makeAudioSeedFromTurnSeed(turnSeedA, algo);
  if (String(s1) !== String(s2)) {
    throw new Error('FAIL: makeAudioSeedFromTurnSeed not deterministic for identical inputs');
  }
  log('✓ audio_seed deterministic for same (turn_seed, audio_algo_version)');

  const s3 = makeAudioSeedFromTurnSeed(turnSeedB, algo);
  if (String(s1) === String(s3)) {
    throw new Error('FAIL: makeAudioSeedFromTurnSeed not sensitive to turn_seed changes');
  }
  log('✓ audio_seed changes when turn_seed changes');
}

async function dbTests(): Promise<void> {
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
  const mig009 = path.join(process.cwd(), 'migrations', '009_phase7_rpg_daily_audio.sql');
  await pool.query(fs.readFileSync(mig007, 'utf8'));
  await pool.query(fs.readFileSync(mig008, 'utf8'));
  await pool.query(fs.readFileSync(mig009, 'utf8'));

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

  const campaign = await getOrCreateCampaign({
    userId,
    chartId,
    bundleHash: profile.bundle_hash,
    rpgMapVersion: profile.rpg_map_version,
    rpgAlgoVersion: 'rpg-v1',
    audioAlgoVersion: 'audio-v1',
    initialStateJson: initialState,
  });

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

  const turn = await getOrCreateDailyTurn({
    campaignId: campaign.id,
    transitSnapshot,
    stateJson: campaign.state_json,
  });

  const a1 = await getOrCreateDailyAudioArtifact({ turnId: turn.id });
  const a2 = await getOrCreateDailyAudioArtifact({ turnId: turn.id });

  if (a1.id !== a2.id) {
    throw new Error('FAIL: audio artifact not idempotent by turn_seed (id differs)');
  }
  if (a1.audio_seed !== a2.audio_seed) {
    throw new Error('FAIL: audio_seed differs for identical calls');
  }
  if (a1.status !== 'pending') {
    throw new Error(`FAIL: expected status=pending, got ${a1.status}`);
  }
  if (a1.provider !== 'none') {
    throw new Error(`FAIL: expected provider=none by default, got ${a1.provider}`);
  }
  log('✓ DB audio artifact idempotent, pending, provider=none');

  await pool.end();
}

async function main(): Promise<void> {
  seedTests();
  await dbTests();
  log('\n✅ Phase 7 RPG audio rails tests passed');
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

