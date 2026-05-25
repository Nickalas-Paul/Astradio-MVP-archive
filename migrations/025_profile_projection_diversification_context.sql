-- Profile active-state: cross-day transit aspect diversification (manual review before production).

ALTER TABLE astradio_profile_projection_cache
  ADD COLUMN IF NOT EXISTS diversification_context JSONB;

CREATE INDEX IF NOT EXISTS idx_profile_projection_cache_chart_kind
  ON astradio_profile_projection_cache (chart_id, projection_kind);

COMMENT ON COLUMN astradio_profile_projection_cache.diversification_context IS
  'Last shown transit activations: { calendarDate, aspectKeys, natalBodies, transitBodies, generatedAt }';
