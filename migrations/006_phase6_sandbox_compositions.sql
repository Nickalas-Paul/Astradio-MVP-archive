-- Phase 6 — Sandbox compositions (save/list/reload)
-- Additive. Run with: node scripts/migrate.js (uses POSTGRES_URL)

CREATE TABLE IF NOT EXISTS astradio_sandbox_compositions (
  id TEXT PRIMARY KEY,
  sandbox_state JSONB NOT NULL,
  vector_hash TEXT NOT NULL,
  seed TEXT NOT NULL,
  plan_hash TEXT NOT NULL,
  report JSONB NOT NULL DEFAULT '{}',
  provider TEXT,
  provider_version TEXT,
  export_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_compositions_created_at ON astradio_sandbox_compositions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sandbox_compositions_vector_hash ON astradio_sandbox_compositions(vector_hash);
