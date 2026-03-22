-- Phase 8 Option B — connection intents (peer charts) + relational group invites (additive).

ALTER TABLE astradio_connection_intents
  ADD COLUMN IF NOT EXISTS from_chart_id TEXT REFERENCES astradio_charts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_chart_id TEXT REFERENCES astradio_charts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT 'Connection',
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

UPDATE astradio_connection_intents
SET from_chart_id = chart_id
WHERE chart_id IS NOT NULL AND from_chart_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_astradio_connection_intents_status_to
  ON astradio_connection_intents(to_user_id, status);

CREATE TABLE IF NOT EXISTS astradio_relational_group_invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES astradio_relational_groups(id) ON DELETE CASCADE,
  inviter_user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  invitee_user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  invitee_chart_id TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (inviter_user_id <> invitee_user_id),
  CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_rel_group_invites_group ON astradio_relational_group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_rel_group_invites_invitee_pending
  ON astradio_relational_group_invites(invitee_user_id, status)
  WHERE status = 'pending';
