-- Phase 9A-1: Profile personalization — curated chart highlights on user row.

ALTER TABLE astradio_users
  ADD COLUMN IF NOT EXISTS chart_highlights JSONB DEFAULT NULL;

COMMENT ON COLUMN astradio_users.chart_highlights IS
  'Up to 3 short strings highlighting chart themes for discovery/profile (JSON array).';
