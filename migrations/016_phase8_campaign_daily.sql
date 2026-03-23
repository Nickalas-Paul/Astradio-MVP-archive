-- Phase 8 — Campaign daily transit state + per-user transit context for group anchor.
-- Additive. Requires POSTGRES_URL + migrate.js

CREATE TABLE IF NOT EXISTS astradio_user_transit_context (
  user_id TEXT PRIMARY KEY REFERENCES astradio_users(id) ON DELETE CASCADE,
  context_json JSONB NOT NULL,
  fingerprint TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_transit_context_fingerprint
  ON astradio_user_transit_context(fingerprint);

CREATE TABLE IF NOT EXISTS campaign_daily_state (
  campaign_id TEXT NOT NULL REFERENCES stage5_campaigns(campaign_id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  engine_version TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'group', 'auto')),
  anchor_user_id TEXT,
  transit_context_json JSONB NOT NULL,
  transit_context_fingerprint TEXT NOT NULL,
  daily_state_json JSONB NOT NULL,
  daily_state_hash TEXT NOT NULL,
  derivation_inputs_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, calendar_date, engine_version)
);

CREATE INDEX IF NOT EXISTS idx_campaign_daily_state_campaign
  ON campaign_daily_state(campaign_id, calendar_date DESC);
