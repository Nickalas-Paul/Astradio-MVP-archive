-- Connection intents: canonical relationship_kind, lifecycle states, pending uniqueness.

-- Deduplicate pending rows per pair (keep newest by created_at).
DELETE FROM astradio_connection_intents
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY from_user_id, to_user_id ORDER BY created_at DESC) AS rn
    FROM astradio_connection_intents
    WHERE status = 'pending'
  ) sub
  WHERE sub.rn > 1
);

ALTER TABLE astradio_connection_intents
  ADD COLUMN IF NOT EXISTS relationship_kind TEXT;

UPDATE astradio_connection_intents
SET relationship_kind = 'friend'
WHERE relationship_kind IS NULL;

ALTER TABLE astradio_connection_intents
  ALTER COLUMN relationship_kind SET DEFAULT 'friend';

UPDATE astradio_connection_intents
SET relationship_kind = 'friend'
WHERE relationship_kind IS NULL OR relationship_kind = '';

ALTER TABLE astradio_connection_intents
  ALTER COLUMN relationship_kind SET NOT NULL;

ALTER TABLE astradio_connection_intents
  DROP CONSTRAINT IF EXISTS astradio_connection_intents_relationship_kind_check;
ALTER TABLE astradio_connection_intents
  ADD CONSTRAINT astradio_connection_intents_relationship_kind_check
  CHECK (relationship_kind IN ('friend', 'lover', 'rival', 'collaborator'));

-- Allow declined / cancelled alongside pending / accepted
ALTER TABLE astradio_connection_intents
  DROP CONSTRAINT IF EXISTS astradio_connection_intents_status_check;
ALTER TABLE astradio_connection_intents
  ADD CONSTRAINT astradio_connection_intents_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_astradio_connection_intents_pending_pair
  ON astradio_connection_intents (from_user_id, to_user_id)
  WHERE status = 'pending';
