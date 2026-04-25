CREATE TABLE IF NOT EXISTS astradio_community_relational_weather_daily_artifacts (
  id TEXT PRIMARY KEY,
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('pair', 'group')),
  binding_id TEXT NOT NULL,
  chart_ids_ordered JSONB NOT NULL,
  chart_ids_ordered_hash TEXT NOT NULL,
  canonical_day_bucket TEXT NOT NULL,
  transit_snapshot_hash TEXT NOT NULL,
  relational_weather_state_hash TEXT,
  plan_hash TEXT,
  composition_id TEXT,
  export_job_id TEXT,
  artifact_status TEXT NOT NULL CHECK (artifact_status IN ('available', 'partial', 'failed')),
  text_payload JSONB,
  weather_payload JSONB,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_rel_weather_daily_identity
  ON astradio_community_relational_weather_daily_artifacts (
    scope_kind,
    binding_id,
    chart_ids_ordered_hash,
    canonical_day_bucket
  );

CREATE INDEX IF NOT EXISTS idx_comm_rel_weather_daily_scope
  ON astradio_community_relational_weather_daily_artifacts (
    scope_kind,
    binding_id,
    canonical_day_bucket
  );
