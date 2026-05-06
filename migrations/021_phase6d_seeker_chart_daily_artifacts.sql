-- Phase 6D Alpha — per-viewer pair daily artifacts (seeker-scoped cache).
-- Groups: seeker_chart_id NULL → COALESCE maps to sentinel for uniqueness.

ALTER TABLE astradio_community_relational_weather_daily_artifacts
  ADD COLUMN IF NOT EXISTS seeker_chart_id TEXT NULL;

-- Legacy pair rows had viewer-agnostic semantics; invalidate for seeker-scoped cache.
DELETE FROM astradio_community_relational_weather_daily_artifacts WHERE scope_kind = 'pair';

DROP INDEX IF EXISTS uq_comm_rel_weather_daily_identity;

-- One row per (binding, chart-set hash, day, viewer perspective).
-- Pair: seeker_chart_id = viewer's chart id. Group: seeker_chart_id IS NULL → sentinel via COALESCE.
CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_rel_weather_daily_identity_v3
  ON astradio_community_relational_weather_daily_artifacts (
    binding_id,
    chart_ids_ordered_hash,
    canonical_day_bucket,
    (COALESCE(seeker_chart_id, '!__GROUP_SEEKER__!'))
  );
