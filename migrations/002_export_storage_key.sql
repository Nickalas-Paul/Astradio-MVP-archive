-- Export jobs: support GCS storage_key and optional metadata (payload_hash, prompt_hash, provider, etc.)
-- Run with: node scripts/migrate.js (uses POSTGRES_URL)

ALTER TABLE astradio_export_jobs
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS export_meta JSONB;

COMMENT ON COLUMN astradio_export_jobs.storage_key IS 'gs://bucket/prefix/exportKey.wav when using GCS';
COMMENT ON COLUMN astradio_export_jobs.export_meta IS 'provider, modelVersion, promptHash, payload_hash, duration_s, sha256';
