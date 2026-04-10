-- Bounded Signals inbox (context-anchored, no chat threads).

CREATE TABLE IF NOT EXISTS astradio_signals (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  anchor_type TEXT NOT NULL CHECK (anchor_type IN ('feed_item', 'connection', 'campaign_decision')),
  anchor_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  body_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),
  reply_count INT NOT NULL DEFAULT 0,
  max_replies INT NOT NULL DEFAULT 2,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_astradio_signals_recipient_status
  ON astradio_signals (recipient_user_id, status);
