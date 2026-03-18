-- Phase 8 Stage 5 — Tri-mode campaign persistence (solo, group, auto).
-- Additive. Single creation path; context_key unique; concurrency-safe.
-- rpg_daily_turns.campaign_id may reference either rpg_campaigns or stage5_campaigns (FK dropped).

CREATE TABLE IF NOT EXISTS stage5_campaigns (
  campaign_id TEXT PRIMARY KEY,
  context_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'group', 'auto')),
  owner_user_id TEXT NOT NULL,
  participant_user_ids TEXT[] NOT NULL,
  participant_chart_ids TEXT[] NOT NULL,
  group_id TEXT REFERENCES astradio_relational_groups(id) ON DELETE SET NULL,
  composite_artifact_id TEXT REFERENCES astradio_composite_artifacts(id) ON DELETE SET NULL,
  bundle_hash TEXT,
  state_json JSONB NOT NULL DEFAULT '{}',
  state_hash TEXT NOT NULL DEFAULT '',
  state_version INT NOT NULL DEFAULT 1,
  version_set_json JSONB NOT NULL DEFAULT '{}',
  auto_resolution_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stage5_campaigns_context_key
  ON stage5_campaigns(context_key);

CREATE INDEX IF NOT EXISTS idx_stage5_campaigns_owner
  ON stage5_campaigns(owner_user_id, created_at DESC);

-- List by owner OR participant: query-level filter (no in-memory filter).
CREATE INDEX IF NOT EXISTS idx_stage5_campaigns_participant
  ON stage5_campaigns USING GIN(participant_user_ids);

-- Allow rpg_daily_turns.campaign_id to reference stage5_campaigns.campaign_id (no FK to two tables).
ALTER TABLE rpg_daily_turns
  DROP CONSTRAINT IF EXISTS rpg_daily_turns_campaign_id_fkey;
