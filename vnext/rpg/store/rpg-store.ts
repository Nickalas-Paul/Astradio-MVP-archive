// vnext/rpg/store/rpg-store.ts
// Persistence layer for RPG effects bundles and profiles (Phase 7).

import crypto from 'crypto';
import { Pool } from 'pg';
import type { EphemerisSnapshot } from '../../contracts';
import { canonicalJsonString, hashCanonicalJson } from '../hash/json-hash';
import { buildRpgEffectsBundleFromSnapshot } from '../effects/bundle-from-snapshot';
import type { RPGEffectsBundle } from '../contracts';

const POSTGRES_URL = process.env.POSTGRES_URL;

let pool: any | null = null;

function getPool(): any {
  if (!POSTGRES_URL) {
    throw new Error('RPG store requires POSTGRES_URL');
  }
  if (!pool) {
    pool = new Pool({ connectionString: POSTGRES_URL });
  }
  return pool;
}

async function query<T = any>(text: string, params: any[] = []): Promise<{ rows: T[] }> {
  const p = getPool();
  return p.query(text, params);
}

async function withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

function nanoid(): string {
  return crypto.randomBytes(8).toString('hex');
}

export interface RpgProfileRow {
  id: string;
  user_id: string;
  chart_id: string;
  rpg_map_version: string;
  natal_snapshot_hash: string;
  bundle_hash: string;
  class_slug: string;
  subclass_slug: string;
  rising_modifier_slug: string;
  created_at: string;
}

export interface RpgCampaignRow {
  id: string;
  user_id: string;
  chart_id: string;
  rpg_map_version: string;
  rpg_algo_version: string;
  audio_algo_version: string;
  bundle_hash: string;
  state_json: any;
  state_hash: string;
  state_version: number;
  created_at: string;
  updated_at: string;
}

export interface RpgDailyTurnRow {
  id: string;
  campaign_id: string;
  turn_seed: string;
  transit_snapshot_hash: string;
  state_hash: string;
  rpg_algo_version: string;
  prompt_spec_json: any;
  created_at: string;
}

export interface RpgMemberResponseRow {
  id: string;
  turn_id: string;
  user_id: string;
  choice_id: string;
  response_json: any;
  response_hash: string;
  created_at: string;
}

export interface RpgTurnOutcomeRow {
  id: string;
  turn_id: string;
  outcome_json: any;
  outcome_hash: string;
  new_state_json: any;
  new_state_hash: string;
  created_at: string;
}

export interface RpgDailyAudioRow {
  id: string;
  turn_id: string;
  turn_seed: string;
  audio_algo_version: string;
  audio_seed: string;
  provider: string;
  status: string;
  artifact_url: string | null;
  artifact_meta_json: any;
  created_at: string;
  updated_at: string;
}

export async function upsertEffectsBundle(bundle: RPGEffectsBundle): Promise<{ bundleHash: string }> {
  const { metadata } = bundle;
  const bundleHash = metadata.bundle_hash;
  const json = canonicalJsonString(bundle);

  await query(
    `INSERT INTO rpg_effects_bundles (
       bundle_hash, rpg_map_version, rpg_algo_version, audio_algo_version, natal_snapshot_hash, bundle_json
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (bundle_hash) DO NOTHING`,
    [
      bundleHash,
      metadata.rpg_map_version,
      metadata.rpg_algo_version,
      metadata.audio_algo_version,
      metadata.natal_snapshot_hash,
      json,
    ]
  );

  return { bundleHash };
}

export async function getOrCreateRpgProfileForChart(params: {
  userId: string;
  chartId: string;
  snapshot: EphemerisSnapshot;
}): Promise<RpgProfileRow> {
  const { userId, chartId, snapshot } = params;

  const bundle = buildRpgEffectsBundleFromSnapshot(snapshot);
  const { metadata } = bundle;

  await upsertEffectsBundle(bundle);

  const profileId = `rpg_prof_${nanoid()}`;

  await query(
    `INSERT INTO rpg_profiles (
       id, user_id, chart_id, rpg_map_version, natal_snapshot_hash,
       bundle_hash, class_slug, subclass_slug, rising_modifier_slug
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, chart_id, rpg_map_version, natal_snapshot_hash)
     DO NOTHING`,
    [
      profileId,
      userId,
      chartId,
      String(metadata.rpg_map_version),
      String(metadata.natal_snapshot_hash),
      metadata.bundle_hash,
      bundle.classSlug,
      bundle.subclassSlug,
      bundle.risingModifierSlug,
    ]
  );

  const select = await query<RpgProfileRow>(
    `SELECT
       id, user_id, chart_id, rpg_map_version, natal_snapshot_hash,
       bundle_hash, class_slug, subclass_slug, rising_modifier_slug, created_at
     FROM rpg_profiles
     WHERE user_id = $1 AND chart_id = $2 AND rpg_map_version = $3 AND natal_snapshot_hash = $4`,
    [
      userId,
      chartId,
      String(metadata.rpg_map_version),
      String(metadata.natal_snapshot_hash),
    ]
  );

  const row = select.rows[0];
  if (!row) {
    throw new Error('Failed to insert or load RPG profile row');
  }

  return row;
}

export async function getOrCreateCampaign(params: {
  userId: string;
  chartId: string;
  bundleHash: string;
  rpgMapVersion: string;
  rpgAlgoVersion: string;
  audioAlgoVersion: string;
  initialStateJson: unknown;
}): Promise<RpgCampaignRow> {
  const { userId, chartId, bundleHash, rpgMapVersion, rpgAlgoVersion, audioAlgoVersion, initialStateJson } = params;
  const campaignId = `rpg_camp_${nanoid()}`;
  const stateHash = hashCanonicalJson(initialStateJson);

  await query(
    `INSERT INTO rpg_campaigns (
       id, user_id, chart_id, rpg_map_version, rpg_algo_version, audio_algo_version,
       bundle_hash, state_json, state_hash
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, chart_id, rpg_map_version, rpg_algo_version)
     DO NOTHING`,
    [
      campaignId,
      userId,
      chartId,
      rpgMapVersion,
      rpgAlgoVersion,
      audioAlgoVersion,
      bundleHash,
      canonicalJsonString(initialStateJson),
      stateHash,
    ]
  );

  const select = await query<RpgCampaignRow>(
    `SELECT
       id, user_id, chart_id, rpg_map_version, rpg_algo_version, audio_algo_version,
       bundle_hash, state_json, state_hash, state_version, created_at, updated_at
     FROM rpg_campaigns
     WHERE user_id = $1 AND chart_id = $2 AND rpg_map_version = $3 AND rpg_algo_version = $4`,
    [userId, chartId, rpgMapVersion, rpgAlgoVersion]
  );

  const row = select.rows[0];
  if (!row) {
    throw new Error('Failed to insert or load RPG campaign row');
  }
  return row;
}

export async function getCampaignById(id: string): Promise<RpgCampaignRow | null> {
  const res = await query<RpgCampaignRow>(
    `SELECT
       id, user_id, chart_id, rpg_map_version, rpg_algo_version, audio_algo_version,
       bundle_hash, state_json, state_hash, state_version, created_at, updated_at
     FROM rpg_campaigns
     WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function getDailyTurnBySeed(seed: string): Promise<RpgDailyTurnRow | null> {
  const res = await query<RpgDailyTurnRow>(
    `SELECT
       id, campaign_id, turn_seed, transit_snapshot_hash, state_hash,
       rpg_algo_version, prompt_spec_json, created_at
     FROM rpg_daily_turns
     WHERE turn_seed = $1`,
    [seed]
  );
  return res.rows[0] ?? null;
}

export async function getDailyTurnById(id: string): Promise<RpgDailyTurnRow | null> {
  const res = await query<RpgDailyTurnRow>(
    `SELECT
       id, campaign_id, turn_seed, transit_snapshot_hash, state_hash,
       rpg_algo_version, prompt_spec_json, created_at
     FROM rpg_daily_turns
     WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function createDailyTurnIfMissing(params: {
  campaignId: string;
  turnSeed: string;
  transitSnapshotHash: string;
  stateHash: string;
  rpgAlgoVersion: string;
  promptSpec: unknown;
}): Promise<RpgDailyTurnRow> {
  const { campaignId, turnSeed, transitSnapshotHash, stateHash, rpgAlgoVersion, promptSpec } = params;
  const id = `rpg_turn_${nanoid()}`;

  await query(
    `INSERT INTO rpg_daily_turns (
       id, campaign_id, turn_seed, transit_snapshot_hash, state_hash,
       rpg_algo_version, prompt_spec_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (turn_seed)
     DO NOTHING`,
    [
      id,
      campaignId,
      turnSeed,
      transitSnapshotHash,
      stateHash,
      rpgAlgoVersion,
      canonicalJsonString(promptSpec),
    ]
  );

  const res = await query<RpgDailyTurnRow>(
    `SELECT
       id, campaign_id, turn_seed, transit_snapshot_hash, state_hash,
       rpg_algo_version, prompt_spec_json, created_at
     FROM rpg_daily_turns
     WHERE turn_seed = $1`,
    [turnSeed]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error('Failed to insert or load RPG daily turn row');
  }
  return row;
}

export async function insertResponseIfMissing(params: {
  turnId: string;
  userId: string;
  choiceId: string;
  responseJson: unknown;
  responseHash: string;
}): Promise<RpgMemberResponseRow> {
  const { turnId, userId, choiceId, responseJson, responseHash } = params;
  const id = `rpg_resp_${nanoid()}`;

  await query(
    `INSERT INTO rpg_member_responses (
       id, turn_id, user_id, choice_id, response_json, response_hash
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (turn_id, user_id)
     DO NOTHING`,
    [id, turnId, userId, choiceId, canonicalJsonString(responseJson), responseHash]
  );

  const res = await query<RpgMemberResponseRow>(
    `SELECT
       id, turn_id, user_id, choice_id, response_json, response_hash, created_at
     FROM rpg_member_responses
     WHERE turn_id = $1 AND user_id = $2`,
    [turnId, userId]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error('Failed to insert or load RPG member response row');
  }
  return row;
}

export async function listResponsesByTurn(turnId: string): Promise<RpgMemberResponseRow[]> {
  const res = await query<RpgMemberResponseRow>(
    `SELECT
       id, turn_id, user_id, choice_id, response_json, response_hash, created_at
     FROM rpg_member_responses
     WHERE turn_id = $1
     ORDER BY created_at ASC`,
    [turnId]
  );
  return res.rows;
}

export async function getOutcomeByTurn(turnId: string): Promise<RpgTurnOutcomeRow | null> {
  const res = await query<RpgTurnOutcomeRow>(
    `SELECT
       id, turn_id, outcome_json, outcome_hash, new_state_json, new_state_hash, created_at
     FROM rpg_turn_outcomes
     WHERE turn_id = $1`,
    [turnId]
  );
  return res.rows[0] ?? null;
}

export async function getLatestTurnForCampaign(campaignId: string): Promise<RpgDailyTurnRow | null> {
  const res = await query<RpgDailyTurnRow>(
    `SELECT
       id, campaign_id, turn_seed, transit_snapshot_hash, state_hash,
       rpg_algo_version, prompt_spec_json, created_at
     FROM rpg_daily_turns
     WHERE campaign_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [campaignId]
  );
  return res.rows[0] ?? null;
}

export async function getBundleByHash(bundleHash: string): Promise<{ bundle_json: any } | null> {
  const res = await query<{ bundle_json: any }>(
    `SELECT bundle_json
     FROM rpg_effects_bundles
     WHERE bundle_hash = $1`,
    [bundleHash]
  );
  return res.rows[0] ?? null;
}

export async function getAudioByTurnSeed(turnSeed: string): Promise<RpgDailyAudioRow | null> {
  const res = await query<RpgDailyAudioRow>(
    `SELECT
       id, turn_id, turn_seed, audio_algo_version, audio_seed,
       provider, status, artifact_url, artifact_meta_json, created_at, updated_at
     FROM rpg_daily_audio_artifacts
     WHERE turn_seed = $1`,
    [turnSeed]
  );
  return res.rows[0] ?? null;
}

export async function createAudioIfMissing(params: {
  turnId: string;
  turnSeed: string;
  audioAlgoVersion: string;
  audioSeed: string;
  provider: string;
}): Promise<RpgDailyAudioRow> {
  const { turnId, turnSeed, audioAlgoVersion, audioSeed, provider } = params;
  const id = `rpg_aud_${nanoid()}`;

  await query(
    `INSERT INTO rpg_daily_audio_artifacts (
       id, turn_id, turn_seed, audio_algo_version, audio_seed, provider, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (turn_seed)
     DO NOTHING`,
    [id, turnId, turnSeed, audioAlgoVersion, audioSeed, provider]
  );

  const row = await getAudioByTurnSeed(turnSeed);
  if (!row) {
    throw new Error('Failed to insert or load RPG daily audio artifact row');
  }
  return row;
}

export async function finalizeTurnTransactional(params: {
  turnId: string;
  buildOutcomeAndState: (args: {
    campaign: RpgCampaignRow;
    responses: RpgMemberResponseRow[];
  }) => {
    outcomeJson: unknown;
    outcomeHash: string;
    newStateJson: unknown;
    newStateHash: string;
  };
}): Promise<RpgTurnOutcomeRow> {
  const { turnId, buildOutcomeAndState } = params;

  return withTransaction(async (client): Promise<RpgTurnOutcomeRow> => {
    const existingRes = await client.query(
      `SELECT
         id, turn_id, outcome_json, outcome_hash, new_state_json, new_state_hash, created_at
       FROM rpg_turn_outcomes
       WHERE turn_id = $1`,
      [turnId]
    );
    if (existingRes.rows[0]) {
      return existingRes.rows[0];
    }

    const turnRes = await client.query(
      `SELECT
         id, campaign_id, turn_seed, transit_snapshot_hash, state_hash,
         rpg_algo_version, prompt_spec_json, created_at
       FROM rpg_daily_turns
       WHERE id = $1`,
      [turnId]
    );
    const turn = turnRes.rows[0];
    if (!turn) {
      throw new Error(`[rpg-outcome] Turn not found (tx): ${turnId}`);
    }

    const campaignRes = await client.query(
      `SELECT
         id, user_id, chart_id, rpg_map_version, rpg_algo_version, audio_algo_version,
         bundle_hash, state_json, state_hash, state_version, created_at, updated_at
       FROM rpg_campaigns
       WHERE id = $1
       FOR UPDATE`,
      [turn.campaign_id]
    );
    const campaign = campaignRes.rows[0];
    if (!campaign) {
      throw new Error(`[rpg-outcome] Campaign not found (tx): ${turn.campaign_id}`);
    }

    const responsesRes = await client.query(
      `SELECT
         id, turn_id, user_id, choice_id, response_json, response_hash, created_at
       FROM rpg_member_responses
       WHERE turn_id = $1
       ORDER BY created_at ASC`,
      [turnId]
    );
    const responses = responsesRes.rows;

    const { outcomeJson, outcomeHash, newStateJson, newStateHash } = buildOutcomeAndState({
      campaign,
      responses,
    });

    const id = `rpg_out_${nanoid()}`;

    await client.query(
      `INSERT INTO rpg_turn_outcomes (
         id, turn_id, outcome_json, outcome_hash, new_state_json, new_state_hash
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (turn_id)
       DO NOTHING`,
      [
        id,
        turnId,
        canonicalJsonString(outcomeJson),
        outcomeHash,
        canonicalJsonString(newStateJson),
        newStateHash,
      ]
    );

    const outRes = await client.query(
      `SELECT
         id, turn_id, outcome_json, outcome_hash, new_state_json, new_state_hash, created_at
       FROM rpg_turn_outcomes
       WHERE turn_id = $1`,
      [turnId]
    );
    const row = outRes.rows[0];
    if (!row) {
      throw new Error('Failed to insert or load RPG turn outcome row (tx)');
    }

    await client.query(
      `UPDATE rpg_campaigns
       SET state_json = $1,
           state_hash = $2,
           state_version = state_version + 1,
           updated_at = NOW()
       WHERE id = $3`,
      [canonicalJsonString(newStateJson), newStateHash, campaign.id]
    );

    return row;
  });
}

export async function insertOutcomeIfMissing(params: {
  turnId: string;
  outcomeJson: unknown;
  outcomeHash: string;
  newStateJson: unknown;
  newStateHash: string;
}): Promise<RpgTurnOutcomeRow> {
  const { turnId, outcomeJson, outcomeHash, newStateJson, newStateHash } = params;
  const id = `rpg_out_${nanoid()}`;

  await query(
    `INSERT INTO rpg_turn_outcomes (
       id, turn_id, outcome_json, outcome_hash, new_state_json, new_state_hash
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (turn_id)
     DO NOTHING`,
    [id, turnId, canonicalJsonString(outcomeJson), outcomeHash, canonicalJsonString(newStateJson), newStateHash]
  );

  const res = await query<RpgTurnOutcomeRow>(
    `SELECT
       id, turn_id, outcome_json, outcome_hash, new_state_json, new_state_hash, created_at
     FROM rpg_turn_outcomes
     WHERE turn_id = $1`,
    [turnId]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error('Failed to insert or load RPG turn outcome row');
  }
  return row;
}

export async function updateCampaignState(params: {
  campaignId: string;
  newStateJson: unknown;
  newStateHash: string;
}): Promise<void> {
  const { campaignId, newStateJson, newStateHash } = params;
  await query(
    `UPDATE rpg_campaigns
     SET state_json = $1,
         state_hash = $2,
         state_version = state_version + 1,
         updated_at = NOW()
     WHERE id = $3`,
    [canonicalJsonString(newStateJson), newStateHash, campaignId]
  );
}


