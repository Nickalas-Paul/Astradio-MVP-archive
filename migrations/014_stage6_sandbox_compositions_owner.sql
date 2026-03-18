-- Stage 6 — Sandbox compositions user isolation.
-- Additive. Run with: node scripts/migrate.js (uses POSTGRES_URL)
-- NULL owner_user_id rows are not backfilled; they remain inaccessible.

ALTER TABLE astradio_sandbox_compositions
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_sandbox_compositions_owner_created
  ON astradio_sandbox_compositions(owner_user_id, created_at DESC);
