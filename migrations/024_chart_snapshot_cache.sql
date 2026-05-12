-- SNAPSHOT CACHING - PHASE 1: DATABASE SCHEMA
-- Snapshots are deterministic for fixed birth data; store once for compatibility / discovery.

ALTER TABLE astradio_charts
  ADD COLUMN IF NOT EXISTS snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS snapshot_computed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_charts_snapshot_exists
  ON astradio_charts(id)
  WHERE snapshot_json IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_charts_snapshot_missing
  ON astradio_charts(id)
  WHERE snapshot_json IS NULL;

COMMENT ON COLUMN astradio_charts.snapshot_json IS
  'Cached ephemeris snapshot (planets, houses, angles) for this natal chart. Computed at chart creation or backfill.';

COMMENT ON COLUMN astradio_charts.snapshot_computed_at IS
  'When snapshot_json was last computed. Null if never computed.';
