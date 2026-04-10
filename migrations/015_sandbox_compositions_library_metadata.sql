-- Profile library metadata on sandbox compositions (additive columns only)

ALTER TABLE astradio_sandbox_compositions
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS composition_type TEXT,
  ADD COLUMN IF NOT EXISTS object_identity_hash TEXT;
