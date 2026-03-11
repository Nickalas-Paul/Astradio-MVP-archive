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
import type { EphemerisSnapshot } from '../contracts';
import { makeAudioSeedFromTurnSeed } from '../rpg/hash/seeds';
import type { AudioAlgoVersion, TurnSeed } from '../rpg/contracts';
import { getOrCreateRpgProfileForChart, getOrCreateCampaign, getAudioByTurnSeed } from '../rpg/store/rpg-store';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { initialCampaignState } from '../rpg/campaign/state-machine';
import { getOrCreateDailyTurn } from '../rpg/campaign/turn-service';
import { ensureDailyAudioArtifactForTurn } from '../rpg/campaign/audio-service';
import { buildCampaignView } from '../rpg/campaign/view';
import { getTestRunTag, deriveDeterministicDay } from './_test-run-tag';

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

  // Diagnostics: confirm DB and initial RPG table counts (single line each).
  const meta = await pool.query('SELECT current_database() AS db, current_schema() AS schema');
  const m = meta.rows[0];
  log(`[phase7-rpg-audio/db] database=${m.db} schema=${m.schema}`);

  const countsBefore = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM rpg_campaigns) AS campaigns,
       (SELECT COUNT(*) FROM rpg_daily_turns) AS turns,
       (SELECT COUNT(*) FROM rpg_member_responses) AS responses,
       (SELECT COUNT(*) FROM rpg_turn_outcomes) AS outcomes,
       (SELECT COUNT(*) FROM rpg_daily_audio_artifacts) AS audio`
  );
  const cb = countsBefore.rows[0];
  log(
    `[phase7-rpg-audio/counts-before] campaigns=${cb.campaigns} turns=${cb.turns} responses=${cb.responses} outcomes=${cb.outcomes} audio=${cb.audio}`
  );

  const mig007 = path.join(process.cwd(), 'migrations', '007_phase7_rpg_bundles_profiles.sql');
  const mig008 = path.join(process.cwd(), 'migrations', '008_phase7_rpg_campaigns.sql');
  const mig009 = path.join(process.cwd(), 'migrations', '009_phase7_rpg_daily_audio.sql');
  await pool.query(fs.readFileSync(mig007, 'utf8'));
  await pool.query(fs.readFileSync(mig008, 'utf8'));
  await pool.query(fs.readFileSync(mig009, 'utf8'));

  const tag = getTestRunTag('phase7-rpg-audio-test');
  const userId = `user_test_audio_${tag}`;
  const chartId = `chart_test_audio_${tag}`;

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

  // Derive a deterministic, run-tagged transit timestamp to avoid turn_seed
  // collisions across runs while remaining reproducible for a given tag.
  const day = deriveDeterministicDay({
    tag: tag,
    salt: 'phase7-rpg-audio-test',
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
      { bodyA: 'sun', bodyB: 'saturn', type: 'square', orb: 2 },
      { bodyA: 'moon', bodyB: 'uranus', type: 'conjunction', orb: 1.5 },
      { bodyA: 'venus', bodyB: 'neptune', type: 'trine', orb: 3 },
    ],
    moonPhase: 0.7,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };

  const turn = await getOrCreateDailyTurn({
    campaignId: campaign.id,
    transitSnapshot,
    stateJson: campaign.state_json,
  });

  // Diagnostics: show seed inputs and any existing audio rows for this seed.
  log(
    `[phase7-rpg-audio/seed-inputs] campaign_id=${campaign.id} state_hash=${campaign.state_hash} transit_ts=${transitSnapshot.ts} algo=rpg-v1`
  );
  log(`[phase7-rpg-audio/turn] id=${turn.id} seed=${turn.turn_seed}`);

  const existingForSeed = await pool.query(
    `SELECT id, turn_id, turn_seed, audio_seed, status, provider, created_at
     FROM rpg_daily_audio_artifacts
     WHERE turn_seed = $1`,
    [turn.turn_seed]
  );
  log(`[phase7-rpg-audio/pre-audio] existing_for_seed=${existingForSeed.rowCount}`);
  if (existingForSeed.rowCount > 0) {
    const r = existingForSeed.rows[0];
    log(
      `[phase7-rpg-audio/pre-audio-row] id=${r.id} turn_id=${r.turn_id} seed=${r.turn_seed} status=${r.status} provider=${r.provider} created_at=${r.created_at}`
    );
  }

  // Before ensure: no audio row, and view builder is read-only.
  const preRow = await getAudioByTurnSeed(turn.turn_seed);
  if (preRow !== null) {
    throw new Error('FAIL: expected no audio row before ensureDailyAudioArtifactForTurn');
  }

  const viewBefore = await buildCampaignView({ campaignId: campaign.id, userId });
  if (viewBefore.audio != null) {
    throw new Error('FAIL: buildCampaignView should not create audio rows (audio should be null before ensure)');
  }
  const preRowAfterView = await getAudioByTurnSeed(turn.turn_seed);
  if (preRowAfterView !== null) {
    throw new Error('FAIL: buildCampaignView appears to have created an audio row');
  }

  const a1 = await ensureDailyAudioArtifactForTurn({ turnId: turn.id });
  const a2 = await ensureDailyAudioArtifactForTurn({ turnId: turn.id });

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
  if (a1.artifact_meta_json != null && typeof a1.artifact_meta_json !== 'object') {
    throw new Error('FAIL: expected artifact_meta_json to be an object or null');
  }
  log('✓ DB audio artifact idempotent, pending, provider=none, meta sane');

  const viewAfter = await buildCampaignView({ campaignId: campaign.id, userId });
  if (!viewAfter.audio) {
    // eslint-disable-next-line no-console
    console.error('DEBUG viewAfter without audio:', JSON.stringify(viewAfter, null, 2));
    throw new Error('FAIL: expected campaign view to expose audio block after ensure');
  }
  if (viewAfter.audio.status !== 'pending') {
    throw new Error(`FAIL: expected view.audio.status=pending, got ${viewAfter.audio.status}`);
  }
  if (viewAfter.audio.audio_seed !== a1.audio_seed) {
    throw new Error('FAIL: view.audio.audio_seed does not match stored row');
  }

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

