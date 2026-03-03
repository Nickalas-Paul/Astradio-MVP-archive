-- Phase 7 — RPG effects bundles and profiles
-- Additive only. Run with: node scripts/migrate.js (uses POSTGRES_URL)

CREATE TABLE IF NOT EXISTS rpg_effects_bundles (
  bundle_hash TEXT PRIMARY KEY,
  rpg_map_version TEXT NOT NULL,
  rpg_algo_version TEXT NOT NULL,
  audio_algo_version TEXT NOT NULL,
  natal_snapshot_hash TEXT NOT NULL,
  bundle_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpg_effects_bundles_lookup
  ON rpg_effects_bundles (natal_snapshot_hash, rpg_map_version);

CREATE TABLE IF NOT EXISTS rpg_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  chart_id TEXT NOT NULL,
  rpg_map_version TEXT NOT NULL,
  natal_snapshot_hash TEXT NOT NULL,
  bundle_hash TEXT NOT NULL REFERENCES rpg_effects_bundles(bundle_hash),
  class_slug TEXT NOT NULL,
  subclass_slug TEXT NOT NULL,
  rising_modifier_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chart_id, rpg_map_version, natal_snapshot_hash)
);

CREATE INDEX IF NOT EXISTS idx_rpg_profiles_user_chart
  ON rpg_profiles (user_id, chart_id);

