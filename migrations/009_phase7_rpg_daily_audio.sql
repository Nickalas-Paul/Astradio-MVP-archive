-- Phase 7 — RPG daily audio artifacts (deterministic rails only)
-- Additive only. No protected table references.

CREATE TABLE IF NOT EXISTS rpg_daily_audio_artifacts (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL REFERENCES rpg_daily_turns(id) ON DELETE CASCADE,
  turn_seed TEXT NOT NULL,
  audio_algo_version TEXT NOT NULL,
  audio_seed TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  artifact_url TEXT NULL,
  artifact_meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (turn_seed)
);

CREATE INDEX IF NOT EXISTS idx_rpg_daily_audio_turn_id
  ON rpg_daily_audio_artifacts (turn_id);

CREATE INDEX IF NOT EXISTS idx_rpg_daily_audio_status
  ON rpg_daily_audio_artifacts (status);

DO $$
BEGIN
  ALTER TABLE rpg_daily_audio_artifacts
    ADD CONSTRAINT rpg_daily_audio_provider_check
    CHECK (provider IN ('none', 'lyria', 'local_wav'));
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists; ignore.
    NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE rpg_daily_audio_artifacts
    ADD CONSTRAINT rpg_daily_audio_status_check
    CHECK (status IN ('pending', 'ready', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists; ignore.
    NULL;
END $$;

