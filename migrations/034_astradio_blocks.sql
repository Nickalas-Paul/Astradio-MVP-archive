-- User blocks: prevent contact and hide from Discovery.

CREATE TABLE IF NOT EXISTS astradio_blocks (
  id TEXT PRIMARY KEY,
  blocker_user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_user_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_astradio_blocks_blocker ON astradio_blocks(blocker_user_id);
CREATE INDEX IF NOT EXISTS idx_astradio_blocks_blocked ON astradio_blocks(blocked_user_id);
