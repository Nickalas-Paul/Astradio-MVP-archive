-- Phase 8 — Minimal user profiles for Campaign testing
-- Additive only. Run with: node scripts/migrate.js (uses POSTGRES_URL)

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  chart_id TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  birth_time TEXT NOT NULL,
  birth_location TEXT NOT NULL,
  natal_snapshot_hash TEXT,
  bundle_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

