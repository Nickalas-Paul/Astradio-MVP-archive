CREATE TABLE IF NOT EXISTS tiktok_tokens (
  id SERIAL PRIMARY KEY,
  open_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT NOW()::TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_tokens_open_id ON tiktok_tokens (open_id);
