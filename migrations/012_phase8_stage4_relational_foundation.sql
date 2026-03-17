-- Phase 8 Stage 4 — Relational Graph + Immutable Composite Artifacts
-- Additive migration only.

CREATE TABLE IF NOT EXISTS astradio_relationships (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  chart_id_low TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  chart_id_high TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  comparison_id TEXT REFERENCES astradio_comparisons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (chart_id_low <> chart_id_high)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stage4_relationship_unique
  ON astradio_relationships(owner_user_id, chart_id_low, chart_id_high, label);
CREATE INDEX IF NOT EXISTS idx_stage4_relationship_owner
  ON astradio_relationships(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS astradio_composite_artifacts (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  relationship_id TEXT REFERENCES astradio_relationships(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES astradio_relational_groups(id) ON DELETE CASCADE,
  chart_ids JSONB NOT NULL,
  vector_hashes JSONB NOT NULL,
  seed TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  plan_hash TEXT NOT NULL,
  composition_id TEXT NOT NULL,
  artifact_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (kind IN ('pair', 'group')),
  CHECK (
    (kind = 'pair' AND relationship_id IS NOT NULL AND group_id IS NULL)
    OR
    (kind = 'group' AND group_id IS NOT NULL AND relationship_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stage4_artifact_unique_hash
  ON astradio_composite_artifacts(owner_user_id, kind, artifact_hash);
CREATE INDEX IF NOT EXISTS idx_stage4_artifact_pair_lookup
  ON astradio_composite_artifacts(owner_user_id, relationship_id, created_at DESC)
  WHERE kind = 'pair';
CREATE INDEX IF NOT EXISTS idx_stage4_artifact_group_lookup
  ON astradio_composite_artifacts(owner_user_id, group_id, created_at DESC)
  WHERE kind = 'group';
