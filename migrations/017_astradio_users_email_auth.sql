-- Real user auth: normalized unique login email + password hash on astradio_users.
-- Additive. NULL email_normalized allowed for legacy rows (multiple NULLs OK with UNIQUE in PostgreSQL).

ALTER TABLE astradio_users
  ADD COLUMN IF NOT EXISTS email_normalized TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_astradio_users_email_normalized_unique
  ON astradio_users (email_normalized)
  WHERE email_normalized IS NOT NULL;
