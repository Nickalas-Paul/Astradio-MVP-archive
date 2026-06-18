-- Direct messaging: conversations and messages between users.

CREATE TABLE IF NOT EXISTS dm_conversations (
  id TEXT PRIMARY KEY,
  participant_a TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  participant_b TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('requested', 'active', 'declined', 'inactive')),
  initiated_by TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(participant_a, participant_b)
);

CREATE INDEX IF NOT EXISTS idx_dm_conversations_participant_a ON dm_conversations(participant_a);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_participant_b ON dm_conversations(participant_b);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_last_message ON dm_conversations(last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS dm_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  audio_export_id TEXT,
  audio_label TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation ON dm_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_unread ON dm_messages(conversation_id, read_at) WHERE read_at IS NULL;
