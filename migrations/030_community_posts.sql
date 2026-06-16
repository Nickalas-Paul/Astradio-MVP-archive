-- Community posts (UGC feed) — separate from legacy astradio_posts group forum.

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS community_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_created ON community_comments(created_at);

CREATE TABLE IF NOT EXISTS community_likes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_community_likes_post ON community_likes(post_id);

CREATE TABLE IF NOT EXISTS community_threads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_threads_name ON community_threads(name);

CREATE TABLE IF NOT EXISTS community_user_settings (
  user_id TEXT PRIMARY KEY REFERENCES astradio_users(id) ON DELETE CASCADE,
  bio TEXT NOT NULL DEFAULT '',
  public_visibility BOOLEAN NOT NULL DEFAULT true,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
