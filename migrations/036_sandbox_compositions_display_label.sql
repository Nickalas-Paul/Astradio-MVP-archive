-- Owner-defined library track label (optional rename)

ALTER TABLE astradio_sandbox_compositions
  ADD COLUMN IF NOT EXISTS display_label TEXT DEFAULT NULL;
