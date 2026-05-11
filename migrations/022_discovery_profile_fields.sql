-- Discovery profile fields for Phase 7A
-- Adds: bio, avatar_url, discoverable_as, looking_for
-- Note: migrations/019_* already exists; this file is numbered 022.

ALTER TABLE astradio_users
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS discoverable_as TEXT DEFAULT 'none'
    CHECK (discoverable_as IN ('friends', 'partners', 'both', 'none')),
  ADD COLUMN IF NOT EXISTS looking_for TEXT;

CREATE INDEX IF NOT EXISTS idx_astradio_users_discoverable_as
  ON astradio_users(discoverable_as)
  WHERE discoverable_as != 'none';

-- Migrate existing discoverable boolean to new field (rows still at default 'none' only)
UPDATE astradio_users
SET discoverable_as = CASE
  WHEN discoverable = true THEN 'both'
  ELSE 'none'
END
WHERE discoverable_as = 'none';

COMMENT ON COLUMN astradio_users.discoverable_as IS
  'Discovery visibility: friends (friend matching only), partners (romantic matching only), both (visible in both), none (not discoverable)';

COMMENT ON COLUMN astradio_users.bio IS
  'User bio (max 500 chars, enforced in API layer)';

COMMENT ON COLUMN astradio_users.looking_for IS
  'What user is looking for in connections (max 500 chars, enforced in API layer)';
