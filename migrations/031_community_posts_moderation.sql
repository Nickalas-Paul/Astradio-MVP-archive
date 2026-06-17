-- Community post moderation status

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'passed';

ALTER TABLE community_posts
  DROP CONSTRAINT IF EXISTS community_posts_moderation_status_check;

ALTER TABLE community_posts
  ADD CONSTRAINT community_posts_moderation_status_check
  CHECK (moderation_status IN ('pending', 'passed', 'failed', 'skipped', 'error'));

CREATE INDEX IF NOT EXISTS idx_community_posts_moderation_feed
  ON community_posts(moderation_status, created_at DESC)
  WHERE moderation_status IN ('passed', 'skipped', 'error');
