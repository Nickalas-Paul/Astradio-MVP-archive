// vnext/rpg/store/rpg-store.ts
// Persistence layer for RPG effects bundles and profiles (Phase 7).

import crypto from 'crypto';
import type { EphemerisSnapshot } from '../../contracts';
import { canonicalJsonString } from '../hash/json-hash';
import { buildRpgEffectsBundleFromSnapshot } from '../effects/bundle-from-snapshot';
import type { RPGEffectsBundle } from '../contracts';
import { buildStatBlock } from '../stat-block-builder';
import type { StatBlock, StatDerivationTrace } from '../types';

type PgQueryResult<T = any> = { rows: T[] };

type PgPoolLike = {
  query: (text: string, params?: any[]) => Promise<PgQueryResult>;
  connect: () => Promise<{
    query: (text: string, params?: any[]) => Promise<PgQueryResult>;
    release: () => void;
  }>;
  end?: () => Promise<void>;
};

const POSTGRES_URL = process.env.POSTGRES_URL;

let pool: PgPoolLike | null = null;

function loadPg(): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // Defer loading pg to runtime so Next build does not need to resolve it.
  return require('pg');
}

function getPool(): PgPoolLike {
  if (!POSTGRES_URL) {
    throw new Error('RPG store requires POSTGRES_URL');
  }
  if (!pool) {
    const { Pool } = loadPg();
    pool = new Pool({
      connectionString: POSTGRES_URL,
      ...(process.env.NODE_ENV === 'production'
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    }) as PgPoolLike;
  }
  return pool;
}

async function query<T = any>(text: string, params: any[] = []): Promise<{ rows: T[] }> {
  const p = getPool();
  // pg's QueryResult is compatible with this shape at runtime.
  return p.query(text, params) as unknown as { rows: T[] };
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

// Phase 8 — minimal user profile storage for Campaign testing.
export interface UserProfileRow {
  user_id: string;
  chart_id: string;
  birth_date: string;
  birth_time: string;
  birth_location: string;
  natal_snapshot_hash: string | null;
  bundle_hash: string | null;
  created_at: string;
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

/** Stage 5 campaign row shape (for lookup). */
interface Stage5CampaignRow {
  campaign_id: string;
  owner_user_id: string;
  participant_chart_ids: string[];
  bundle_hash: string | null;
  state_json: unknown;
  state_hash: string;
  state_version: number;
  version_set_json: unknown;
  created_at: string;
  updated_at: string;
}

export async function getCampaignById(id: string): Promise<RpgCampaignRow | null> {
  const stage5Res = await query<Stage5CampaignRow>(
    `SELECT campaign_id, owner_user_id, participant_chart_ids, bundle_hash, state_json, state_hash, state_version, version_set_json, created_at, updated_at
     FROM stage5_campaigns WHERE campaign_id = $1`,
    [id]
  );
  const s5 = stage5Res.rows[0];
  if (s5) {
    const versionSet = (s5.version_set_json as { rpg_map_version?: string; rpg_algo_version?: string; audio_algo_version?: string }) || {};
    return {
      id: s5.campaign_id,
      user_id: s5.owner_user_id,
      chart_id: Array.isArray(s5.participant_chart_ids) && s5.participant_chart_ids.length > 0 ? s5.participant_chart_ids[0] : '',
      rpg_map_version: versionSet.rpg_map_version ?? 'v1',
      rpg_algo_version: versionSet.rpg_algo_version ?? 'rpg-v1',
      audio_algo_version: versionSet.audio_algo_version ?? 'audio-v1',
      bundle_hash: s5.bundle_hash ?? '',
      state_json: s5.state_json,
      state_hash: s5.state_hash,
      state_version: s5.state_version,
      created_at: s5.created_at,
      updated_at: s5.updated_at,
    };
  }
  return null;
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

/**
 * Load bundle by hash and ensure Phase 1 stats are present.
 * rpg-v1 rows (or missing statBlock) are enriched by recomputing from the natal snapshot.
 */
export async function getBundleWithStats(
  bundleHash: string,
  snapshot: EphemerisSnapshot
): Promise<{
  bundle: RPGEffectsBundle;
  statBlock: StatBlock;
  statTrace: StatDerivationTrace;
  recomputed: boolean;
} | null> {
  const row = await getBundleByHash(bundleHash);
  if (!row?.bundle_json) return null;
  const raw = row.bundle_json as RPGEffectsBundle;
  const algo = String(raw.metadata?.rpg_algo_version ?? '');
  const needsRecompute =
    algo === 'rpg-v1' || raw.statBlock == null || raw.statTrace == null;
  if (!needsRecompute && raw.statBlock && raw.statTrace) {
    return {
      bundle: raw,
      statBlock: raw.statBlock as StatBlock,
      statTrace: raw.statTrace as StatDerivationTrace,
      recomputed: false,
    };
  }
  const { stats, trace } = buildStatBlock(snapshot);
  const enriched: RPGEffectsBundle = {
    ...raw,
    metadata: {
      ...raw.metadata,
      rpg_algo_version: 'rpg-v2' as RPGEffectsBundle['metadata']['rpg_algo_version'],
    },
    statBlock: stats,
    statTrace: trace,
  };
  return {
    bundle: enriched,
    statBlock: stats,
    statTrace: trace,
    recomputed: true,
  };
}

/** Get profile row that links (user_id, chart_id) to the given bundle_hash. Used for diagnostics. */
export async function getProfileByUserAndBundle(
  userId: string,
  chartId: string,
  bundleHash: string
): Promise<RpgProfileRow | null> {
  const res = await query<RpgProfileRow>(
    `SELECT id, user_id, chart_id, rpg_map_version, natal_snapshot_hash,
            bundle_hash, class_slug, subclass_slug, rising_modifier_slug, created_at
     FROM rpg_profiles
     WHERE user_id = $1 AND chart_id = $2 AND bundle_hash = $3`,
    [userId, chartId, bundleHash]
  );
  return res.rows[0] ?? null;
}

// Phase 8 helpers: minimal user_profiles table for real user + natal storage.
// Idempotent bootstrap so Preview (and any env that has not run db:migrate) can use this table.

const USER_PROFILES_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  chart_id TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  birth_time TEXT NOT NULL,
  birth_location TEXT NOT NULL,
  natal_snapshot_hash TEXT,
  bundle_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

async function ensureUserProfilesTable(): Promise<void> {
  await query(USER_PROFILES_BOOTSTRAP_SQL);
}

export async function upsertUserProfileForPhase8(params: {
  userId: string;
  chartId: string;
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  natalSnapshotHash: string;
  bundleHash: string;
}): Promise<UserProfileRow> {
  const { userId, chartId, birthDate, birthTime, birthLocation, natalSnapshotHash, bundleHash } = params;

  await ensureUserProfilesTable();
  await query(
    `INSERT INTO user_profiles (
       user_id, chart_id, birth_date, birth_time, birth_location,
       natal_snapshot_hash, bundle_hash
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id)
     DO UPDATE SET
       chart_id = EXCLUDED.chart_id,
       birth_date = EXCLUDED.birth_date,
       birth_time = EXCLUDED.birth_time,
       birth_location = EXCLUDED.birth_location,
       natal_snapshot_hash = EXCLUDED.natal_snapshot_hash,
       bundle_hash = EXCLUDED.bundle_hash`,
    [userId, chartId, birthDate, birthTime, birthLocation, natalSnapshotHash, bundleHash]
  );

  const res = await query<UserProfileRow>(
    `SELECT
       user_id, chart_id, birth_date, birth_time, birth_location,
       natal_snapshot_hash, bundle_hash, created_at
     FROM user_profiles
     WHERE user_id = $1`,
    [userId]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error('Failed to insert or load user_profiles row for Phase 8');
  }
  return row;
}

export async function getUserProfileById(userId: string): Promise<UserProfileRow | null> {
  await ensureUserProfilesTable();
  const res = await query<UserProfileRow>(
    `SELECT
       user_id, chart_id, birth_date, birth_time, birth_location,
       natal_snapshot_hash, bundle_hash, created_at
     FROM user_profiles
     WHERE user_id = $1`,
    [userId]
  );
  return res.rows[0] ?? null;
}


export async function updateCampaignState(params: {
  campaignId: string;
  newStateJson: unknown;
  newStateHash: string;
}): Promise<void> {
  const { campaignId, newStateJson, newStateHash } = params;
  const stateStr = canonicalJsonString(newStateJson);
  const stage5Res = await query<{ campaign_id: string }>(
    `UPDATE stage5_campaigns
     SET state_json = $1::jsonb, state_hash = $2, state_version = state_version + 1, updated_at = NOW()
     WHERE campaign_id = $3
     RETURNING campaign_id`,
    [stateStr, newStateHash, campaignId]
  );
  if (stage5Res.rows.length > 0) return;
  throw new Error(`Campaign not found: ${campaignId}`);
}


