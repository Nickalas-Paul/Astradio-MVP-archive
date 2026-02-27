-- Phase 4 Community CRUD: additive tables only.
-- Run with: node scripts/migrate.js (uses POSTGRES_URL)
-- No public routes for Lineage/AnalysisSet; storage-only until later phase.

-- Likes (post, comment, or chart)
CREATE TABLE IF NOT EXISTS astradio_likes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('post', 'comment', 'chart')),
  item_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_astradio_likes_user ON astradio_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_astradio_likes_item ON astradio_likes(item_type, item_id);

-- Connection intent (stub)
CREATE TABLE IF NOT EXISTS astradio_connection_intents (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  to_user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  chart_id TEXT REFERENCES astradio_charts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_connection_intents_from ON astradio_connection_intents(from_user_id);
CREATE INDEX IF NOT EXISTS idx_astradio_connection_intents_to ON astradio_connection_intents(to_user_id);

-- Stored 64-D vectors for deterministic compat scoring (read-only from compat path)
CREATE TABLE IF NOT EXISTS astradio_chart_vectors (
  chart_id TEXT NOT NULL PRIMARY KEY REFERENCES astradio_charts(id) ON DELETE CASCADE,
  vector64 JSONB NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  encoder_version TEXT NOT NULL DEFAULT 'v1',
  snapshot_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lineage (aggregation planning; storage-only; no public routes in Phase 4)
CREATE TABLE IF NOT EXISTS astradio_lineages (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_lineages_owner ON astradio_lineages(owner_id);

-- Lineage members (chart grouping for future multi-chart use)
CREATE TABLE IF NOT EXISTS astradio_lineage_members (
  id TEXT PRIMARY KEY,
  lineage_id TEXT NOT NULL REFERENCES astradio_lineages(id) ON DELETE CASCADE,
  chart_id TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  generation_index INT NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  side TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_lineage_members_lineage ON astradio_lineage_members(lineage_id);

-- Analysis sets (user-curated chart lists; storage-only; no public routes in Phase 4)
CREATE TABLE IF NOT EXISTS astradio_analysis_sets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  chart_ids JSONB NOT NULL DEFAULT '[]',
  weights JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_analysis_sets_owner ON astradio_analysis_sets(owner_id);

-- Analysis artifact manifests (provenance for exports; storage-only)
CREATE TABLE IF NOT EXISTS astradio_analysis_artifact_manifests (
  id TEXT PRIMARY KEY,
  analysis_set_id TEXT REFERENCES astradio_analysis_sets(id) ON DELETE SET NULL,
  export_id TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_analysis_artifact_manifests_export ON astradio_analysis_artifact_manifests(export_id);
