-- Phase 7 — RPG campaigns and daily turns
-- Additive only. Run with: node scripts/migrate.js (uses POSTGRES_URL)

CREATE TABLE IF NOT EXISTS rpg_campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chart_id TEXT NOT NULL,
  rpg_map_version TEXT NOT NULL,
  rpg_algo_version TEXT NOT NULL,
  audio_algo_version TEXT NOT NULL,
  bundle_hash TEXT NOT NULL,
  state_json JSONB NOT NULL,
  state_hash TEXT NOT NULL,
  state_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chart_id, rpg_map_version, rpg_algo_version)
);

CREATE TABLE IF NOT EXISTS rpg_daily_turns (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES rpg_campaigns(id) ON DELETE CASCADE,
  turn_seed TEXT NOT NULL UNIQUE,
  transit_snapshot_hash TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  rpg_algo_version TEXT NOT NULL,
  prompt_spec_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpg_daily_turns_campaign_created
  ON rpg_daily_turns (campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rpg_member_responses (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL REFERENCES rpg_daily_turns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  response_json JSONB NOT NULL,
  response_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (turn_id, user_id)
);

CREATE TABLE IF NOT EXISTS rpg_turn_outcomes (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL UNIQUE REFERENCES rpg_daily_turns(id) ON DELETE CASCADE,
  outcome_json JSONB NOT NULL,
  outcome_hash TEXT NOT NULL,
  new_state_json JSONB NOT NULL,
  new_state_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

