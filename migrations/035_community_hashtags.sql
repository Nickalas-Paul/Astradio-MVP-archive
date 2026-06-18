-- Community post hashtags and tag registry columns on community_threads.

CREATE TABLE IF NOT EXISTS community_post_hashtags (
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_community_post_hashtags_tag ON community_post_hashtags(tag);
CREATE INDEX IF NOT EXISTS idx_community_post_hashtags_post ON community_post_hashtags(post_id);

ALTER TABLE community_threads
  ADD COLUMN IF NOT EXISTS post_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_threads_name_unique
  ON community_threads(name);
