ALTER TABLE astradio_users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_astradio_users_verification_token
  ON astradio_users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;

-- Backfill: mark all existing users with passwords as verified (they registered before this requirement)
UPDATE astradio_users SET email_verified = true WHERE password_hash IS NOT NULL;
