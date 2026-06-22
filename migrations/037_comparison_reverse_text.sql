-- Dual-orientation connection readings: chartB-as-seeker pronoun perspective

ALTER TABLE astradio_comparisons
  ADD COLUMN IF NOT EXISTS compatibility_text_reverse JSONB DEFAULT NULL;
