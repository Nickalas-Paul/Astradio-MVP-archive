-- Phase 5 — Relational Architecture (Compatibility, Phantom, Groups)
-- Additive only. Run with: node scripts/migrate.js (uses POSTGRES_URL)
-- Rollback: DROP tables in reverse order; ALTER TABLE astradio_charts DROP COLUMN is_non_platform;

-- Extend charts for non-platform entities (single source of truth)
ALTER TABLE astradio_charts ADD COLUMN IF NOT EXISTS is_non_platform BOOLEAN NOT NULL DEFAULT false;

-- Intent profiles: config (seeded read-only)
CREATE TABLE IF NOT EXISTS astradio_compatibility_intent_profiles (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  facet_weights JSONB NOT NULL DEFAULT '{}',
  tie_break_rule TEXT NOT NULL DEFAULT 'vector_hash_asc',
  algorithm_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibility results cache (optional; safe to truncate)
CREATE TABLE IF NOT EXISTS astradio_compatibility_results (
  id TEXT PRIMARY KEY,
  chart_a_id TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  chart_b_id TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  intent_profile_id TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  facet_breakdown JSONB NOT NULL DEFAULT '{}',
  vector_hash_a TEXT NOT NULL,
  vector_hash_b TEXT NOT NULL,
  encoder_version TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chart_a_id, chart_b_id, intent_profile_id)
);
CREATE INDEX IF NOT EXISTS idx_compatibility_results_lookup ON astradio_compatibility_results(chart_a_id, chart_b_id, intent_profile_id);

-- Phantom profiles: config (seeded read-only)
CREATE TABLE IF NOT EXISTS astradio_phantom_profiles (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  transform_type TEXT NOT NULL,
  transform_params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constellation centroids
CREATE TABLE IF NOT EXISTS astradio_constellation_centroids (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  vector64 JSONB NOT NULL,
  eligibility_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relational groups (private, user-created)
CREATE TABLE IF NOT EXISTS astradio_relational_groups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_relational_groups_owner ON astradio_relational_groups(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_relational_groups_owner_slug ON astradio_relational_groups(owner_id, slug);

-- Group members: platform (user_id + chart_id) or non-platform (chart_id only, user_id NULL)
-- chart_id always required for vector lookup
CREATE TABLE IF NOT EXISTS astradio_relational_group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES astradio_relational_groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES astradio_users(id) ON DELETE CASCADE,
  chart_id TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (user_id IS NOT NULL AND chart_id IS NOT NULL)
    OR
    (user_id IS NULL AND chart_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_relational_group_members_group ON astradio_relational_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_relational_group_members_chart ON astradio_relational_group_members(chart_id);
