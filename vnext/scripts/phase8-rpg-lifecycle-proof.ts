#!/usr/bin/env node
/**
 * Phase 8 Step 3 — RPG lifecycle + DB evidence.
 *
 * Runs a full deterministic lifecycle against the live Postgres:
 *   1. Create profile + campaign
 *   2. Create daily turn
 *   3. Submit response
 *   4. Finalize outcome
 *   5. Ensure audio
 *   6. Build campaign view
 *
 * Captures:
 *   - Row counts before/after for RPG tables
 *   - Row counts for a few non-RPG tables (to show no contamination)
 *   - Idempotency behaviour on repeat calls
 */

import 'dotenv/config';
import { Pool } from 'pg';
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
import { ensureDailyAudioArtifactForTurn } from '../rpg/campaign/audio-service';
import { buildCampaignView } from '../rpg/campaign/view';
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

  const tag = getTestRunTag('phase8-rpg-lifecycle-proof');
  const userId = `user_test_lifecycle_${tag}`;
  const chartId = `chart_test_lifecycle_${tag}`;

  // 1) DB + schema confirmation
  const meta = await pool.query('SELECT current_database() AS db, current_schema() AS schema');
  const m = meta.rows[0];
  log(`[phase8-lifecycle/db] database=${m.db} schema=${m.schema}`);

  // Assume migrations already applied via db:migrate, as in Step 2.

  // Helper to capture row counts.
  async function getCounts(label: string): Promise<void> {
    const res = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM rpg_profiles)              AS rpg_profiles,
        (SELECT COUNT(*)::int FROM rpg_campaigns)            AS rpg_campaigns,
        (SELECT COUNT(*)::int FROM rpg_daily_turns)          AS rpg_daily_turns,
        (SELECT COUNT(*)::int FROM rpg_member_responses)     AS rpg_member_responses,
        (SELECT COUNT(*)::int FROM rpg_turn_outcomes)        AS rpg_turn_outcomes,
        (SELECT COUNT(*)::int FROM rpg_daily_audio_artifacts) AS rpg_daily_audio_artifacts,
        (SELECT COUNT(*)::int FROM astradio_users)           AS astradio_users,
        (SELECT COUNT(*)::int FROM astradio_charts)          AS astradio_charts,
        (SELECT COUNT(*)::int FROM astradio_groups)          AS astradio_groups
    `);
    const c = res.rows[0];
    log(
      `[phase8-lifecycle/counts-${label}] ` +
        `rpg_profiles=${c.rpg_profiles} rpg_campaigns=${c.rpg_campaigns} ` +
        `rpg_daily_turns=${c.rpg_daily_turns} rpg_member_responses=${c.rpg_member_responses} ` +
        `rpg_turn_outcomes=${c.rpg_turn_outcomes} rpg_daily_audio_artifacts=${c.rpg_daily_audio_artifacts} ` +
        `astradio_users=${c.astradio_users} astradio_charts=${c.astradio_charts} astradio_groups=${c.astradio_groups}`
    );
  }

  function fail(message: string, meta?: Record<string, unknown>): never {
    const suffix = meta ? ` :: ${JSON.stringify(meta)}` : '';
    throw new Error(`FAIL: ${message}${suffix}`);
  }

  function assertOrFail(condition: boolean, message: string, meta?: Record<string, unknown>): void {
    if (!condition) {
      fail(message, meta);
    }
  }

  async function getNamespaceCounts(): Promise<{
    profiles: number;
    campaigns: number;
    turns: number;
    responses: number;
    outcomes: number;
    audio: number;
  }> {
    const res = await pool.query(
      `
      WITH ns_campaigns AS (
        SELECT id FROM rpg_campaigns WHERE user_id = $1 AND chart_id = $2
      ),
      ns_turns AS (
        SELECT id FROM rpg_daily_turns WHERE campaign_id IN (SELECT id FROM ns_campaigns)
      )
      SELECT
        (SELECT COUNT(*)::int FROM rpg_profiles WHERE user_id = $1 AND chart_id = $2) AS profiles,
        (SELECT COUNT(*)::int FROM ns_campaigns) AS campaigns,
        (SELECT COUNT(*)::int FROM ns_turns) AS turns,
        (SELECT COUNT(*)::int FROM rpg_member_responses WHERE turn_id IN (SELECT id FROM ns_turns)) AS responses,
        (SELECT COUNT(*)::int FROM rpg_turn_outcomes WHERE turn_id IN (SELECT id FROM ns_turns)) AS outcomes,
        (SELECT COUNT(*)::int FROM rpg_daily_audio_artifacts WHERE turn_id IN (SELECT id FROM ns_turns)) AS audio
      `,
      [userId, chartId]
    );
    return res.rows[0];
  }

  // Namespace-scoped cleanup so reruns with same tag are idempotent.
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

  await getCounts('before');
  await cleanupNamespace();
  const nsAfterClean = await getNamespaceCounts();
  log(
    `[phase8-lifecycle/ns-after-clean] ` +
      `profiles=${nsAfterClean.profiles} campaigns=${nsAfterClean.campaigns} ` +
      `turns=${nsAfterClean.turns} responses=${nsAfterClean.responses} ` +
      `outcomes=${nsAfterClean.outcomes} audio=${nsAfterClean.audio}`
  );
  assertOrFail(nsAfterClean.profiles === 0, 'namespace rpg_profiles not empty after cleanup', nsAfterClean);
  assertOrFail(nsAfterClean.campaigns === 0, 'namespace rpg_campaigns not empty after cleanup', nsAfterClean);
  assertOrFail(nsAfterClean.turns === 0, 'namespace rpg_daily_turns not empty after cleanup', nsAfterClean);
  assertOrFail(nsAfterClean.responses === 0, 'namespace rpg_member_responses not empty after cleanup', nsAfterClean);
  assertOrFail(nsAfterClean.outcomes === 0, 'namespace rpg_turn_outcomes not empty after cleanup', nsAfterClean);
  assertOrFail(nsAfterClean.audio === 0, 'namespace rpg_daily_audio_artifacts not empty after cleanup', nsAfterClean);
  await getCounts('before-clean');

  // 3) Execute lifecycle using vnext services.

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
  log(`[phase8-lifecycle/profile] id=${profile.id} bundle_hash=${profile.bundle_hash}`);

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
  log(
    `[phase8-lifecycle/campaign] id=${campaign.id} state_version=${campaign.state_version} state_hash=${campaign.state_hash}`
  );

  const day = deriveDeterministicDay({
    tag,
    salt: 'phase8-rpg-lifecycle-proof',
    minDay: 1,
    maxDay: 28,
  });
  const transitTs = `2036-03-${String(day).padStart(2, '0')}T12:00:00Z`;

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

  const turn1 = await getOrCreateDailyTurn({
    campaignId: campaign.id,
    transitSnapshot,
    stateJson: campaign.state_json,
  });
  const turn2 = await getOrCreateDailyTurn({
    campaignId: campaign.id,
    transitSnapshot,
    stateJson: campaign.state_json,
  });
  log(`[phase8-lifecycle/turn] id1=${turn1.id} id2=${turn2.id} seed=${turn1.turn_seed}`);

  if (turn1.id !== turn2.id) {
    throw new Error('FAIL: getOrCreateDailyTurn not idempotent for lifecycle run');
  }

  const prompt = turn1.prompt_spec_json as any;
  const choiceId: string = Array.isArray(prompt.choice_ids) ? prompt.choice_ids[0] : '';

  const resp1 = await submitResponse({ turnId: turn1.id, userId, choiceId });
  const resp2 = await submitResponse({ turnId: turn1.id, userId, choiceId });
  log(`[phase8-lifecycle/response] id1=${resp1.id} id2=${resp2.id} choice=${resp1.choice_id}`);
  if (resp1.id !== resp2.id) {
    fail('submitResponse not idempotent for same (turn,user,choice)', {
      turnId: turn1.id,
      userId,
      choiceId,
      resp1Id: resp1.id,
      resp2Id: resp2.id,
    });
  }

  // Per-turn invariants before first finalize.
  const turnRowRes = await pool.query(
    `SELECT campaign_id, turn_seed FROM rpg_daily_turns WHERE id = $1`,
    [turn1.id]
  );
  const turnRow = turnRowRes.rows[0];
  if (!turnRow) {
    fail('turn row missing before finalize', { turnId: turn1.id });
  }
  assertOrFail(
    turnRow.campaign_id === campaign.id,
    'turn.campaign_id mismatch for lifecycle namespace',
    { turnId: turn1.id, turnCampaignId: turnRow.campaign_id, expectedCampaignId: campaign.id }
  );

  const outcomesBeforeRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM rpg_turn_outcomes WHERE turn_id = $1`,
    [turn1.id]
  );
  const outcomesBefore = outcomesBeforeRes.rows[0]?.count ?? 0;
  const responsesCountRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM rpg_member_responses WHERE turn_id = $1`,
    [turn1.id]
  );
  const responsesForTurn = responsesCountRes.rows[0]?.count ?? 0;
  log(
    `[phase8-lifecycle/pre-finalize] outcomes_before_for_turn=${outcomesBefore} responses_for_turn=${responsesForTurn}`
  );
  assertOrFail(outcomesBefore === 0, 'outcomes_before_for_turn not zero before first finalize', {
    outcomes_before_for_turn: outcomesBefore,
  });
  assertOrFail(responsesForTurn === 1, 'responses_for_turn not exactly one before first finalize', {
    responses_for_turn: responsesForTurn,
  });

  const beforeCampaign = await getCampaignById(campaign.id);
  if (!beforeCampaign) fail('campaign missing before finalize', { campaignId: campaign.id });

  // First finalize: must create exactly one outcome row and bump state_version once.
  const out1 = await finalizeTurnOutcome({ turnId: turn1.id });
  const outcomesAfterFirstRes = await pool.query(
    `SELECT COUNT(*)::int AS count FROM rpg_turn_outcomes WHERE turn_id = $1`,
    [turn1.id]
  );
  const outcomesAfterFirst = outcomesAfterFirstRes.rows[0]?.count ?? 0;
  assertOrFail(
    outcomesAfterFirst === 1,
    'outcomes_after_for_turn not exactly one after first finalize',
    { outcomes_after_for_turn: outcomesAfterFirst }
  );

  const afterFirstCampaign = await getCampaignById(campaign.id);
  if (!afterFirstCampaign) {
    fail('campaign missing after first finalize', { campaignId: campaign.id });
  }
  log(
    `[phase8-lifecycle/state-after-first] version_before=${beforeCampaign.state_version} ` +
      `version_after=${afterFirstCampaign.state_version}`
  );
  assertOrFail(
    afterFirstCampaign.state_version === beforeCampaign.state_version + 1,
    'state_version did not increment exactly once after first finalize',
    {
      version_before: beforeCampaign.state_version,
      version_after: afterFirstCampaign.state_version,
    }
  );

  // Second finalize: idempotent outcome + no additional version bump.
  const out2 = await finalizeTurnOutcome({ turnId: turn1.id });
  log(`[phase8-lifecycle/outcome] id1=${out1.id} id2=${out2.id}`);
  assertOrFail(out1.id === out2.id, 'finalizeTurnOutcome not idempotent for turn', {
    out1Id: out1.id,
    out2Id: out2.id,
  });

  const afterSecondCampaign = await getCampaignById(campaign.id);
  if (!afterSecondCampaign) {
    fail('campaign missing after second finalize', { campaignId: campaign.id });
  }
  assertOrFail(
    afterSecondCampaign.state_version === afterFirstCampaign.state_version,
    'state_version changed on second finalize',
    {
      version_after_first: afterFirstCampaign.state_version,
      version_after_second: afterSecondCampaign.state_version,
    }
  );

  const a1 = await ensureDailyAudioArtifactForTurn({ turnId: turn1.id });
  const a2 = await ensureDailyAudioArtifactForTurn({ turnId: turn1.id });
  log(`[phase8-lifecycle/audio] id1=${a1.id} id2=${a2.id} status=${a1.status} provider=${a1.provider}`);
  if (a1.id !== a2.id) {
    fail('ensureDailyAudioArtifactForTurn not idempotent by turn_seed', {
      a1Id: a1.id,
      a2Id: a2.id,
      turnId: turn1.id,
    });
  }

  assertOrFail(
    a1.turn_id === turn1.id && a1.turn_seed === turn1.turn_seed,
    'audio artifact not bound to expected turn/seed',
    { audioTurnId: a1.turn_id, audioTurnSeed: a1.turn_seed, turnId: turn1.id, turnSeed: turn1.turn_seed }
  );
  assertOrFail(
    a1.audio_seed === a2.audio_seed,
    'audio_seed changed between ensureDailyAudioArtifactForTurn calls',
    { audioSeed1: a1.audio_seed, audioSeed2: a2.audio_seed }
  );

  const view = await buildCampaignView({ campaignId: campaign.id, userId });
  log(
    `[phase8-lifecycle/view] has_current_turn=${!!view.current_turn} has_outcome=${!!view.outcome} has_audio=${!!view.audio}`
  );
  assertOrFail(!!view.current_turn, 'campaign view missing current_turn after lifecycle run');
  assertOrFail(
    view.current_turn?.turn_seed === turn1.turn_seed,
    'campaign view current_turn turn_seed mismatch',
    { viewTurnSeed: view.current_turn?.turn_seed, turnSeed: turn1.turn_seed }
  );
  assertOrFail(!!view.audio, 'campaign view missing audio block after ensureDailyAudioArtifactForTurn');
  assertOrFail(
    !!view.audio &&
      view.audio.audio_seed === a1.audio_seed &&
      view.audio.status === a1.status,
    'campaign view audio block mismatch with stored artifact',
    {
      viewAudioSeed: view.audio?.audio_seed,
      storedAudioSeed: a1.audio_seed,
      viewStatus: view.audio?.status,
      storedStatus: a1.status,
    }
  );

  await getCounts('after');

  await pool.end();

  log('\n✅ Phase 8 RPG lifecycle proof completed');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

