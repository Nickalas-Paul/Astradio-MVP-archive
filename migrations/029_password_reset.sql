-- Password reset tokens for astradio_users (compat auth stack)
ALTER TABLE astradio_users
  ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMPTZ;
