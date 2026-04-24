-- Persist aggregate reading + export handle on composite rows (same compose run; additive only).

ALTER TABLE astradio_composite_artifacts
  ADD COLUMN IF NOT EXISTS reading_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS export_job_id TEXT;
