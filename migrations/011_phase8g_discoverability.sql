-- Phase 8G: Community discoverability and feed visibility.
-- New profiles are searchable and shown in feed by default; users can opt out.

ALTER TABLE astradio_users
  ADD COLUMN IF NOT EXISTS discoverable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_feed BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN astradio_users.discoverable IS 'When true, user appears in community directory search.';
COMMENT ON COLUMN astradio_users.show_in_feed IS 'When true, profile-creation / join may appear in community feed.';

CREATE INDEX IF NOT EXISTS idx_astradio_users_discoverable ON astradio_users(discoverable) WHERE discoverable = true;
CREATE INDEX IF NOT EXISTS idx_astradio_users_show_in_feed ON astradio_users(show_in_feed) WHERE show_in_feed = true;
