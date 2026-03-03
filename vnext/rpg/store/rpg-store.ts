// vnext/rpg/store/rpg-store.ts
// Persistence layer for RPG effects bundles and profiles (Phase 7).

import crypto from 'crypto';
import { Pool } from 'pg';
import type { EphemerisSnapshot } from '../../contracts';
import { canonicalJsonString } from '../hash/json-hash';
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

  const result = await query<RpgProfileRow>(
    `INSERT INTO rpg_profiles (
       id, user_id, chart_id, rpg_map_version, natal_snapshot_hash,
       bundle_hash, class_slug, subclass_slug, rising_modifier_slug
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, chart_id, rpg_map_version, natal_snapshot_hash)
     DO UPDATE SET
       bundle_hash = EXCLUDED.bundle_hash,
       class_slug = EXCLUDED.class_slug,
       subclass_slug = EXCLUDED.subclass_slug,
       rising_modifier_slug = EXCLUDED.rising_modifier_slug
     RETURNING
       id, user_id, chart_id, rpg_map_version, natal_snapshot_hash,
       bundle_hash, class_slug, subclass_slug, rising_modifier_slug, created_at`,
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

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to upsert RPG profile row');
  }

  return row;
}

