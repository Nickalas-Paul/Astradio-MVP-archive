-- Profile projection cache: deterministic replay for active (A+C(t)) state; additive.

CREATE TABLE IF NOT EXISTS astradio_profile_projection_cache (
  cache_key_hash TEXT PRIMARY KEY,
  user_id TEXT REFERENCES astradio_users(id) ON DELETE SET NULL,
  chart_id TEXT NOT NULL,
  projection_kind TEXT NOT NULL,
  object_identity_hash TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_projection_cache_chart ON astradio_profile_projection_cache(chart_id);
CREATE INDEX IF NOT EXISTS idx_profile_projection_cache_user ON astradio_profile_projection_cache(user_id);
