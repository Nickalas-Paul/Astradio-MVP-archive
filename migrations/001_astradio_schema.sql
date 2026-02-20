-- Astradio durable storage: compat (users, charts, comparisons) + community (groups, posts, memberships) + exports
-- Run with: node scripts/migrate.js (uses POSTGRES_URL)

-- Compat: users (shared by profile and community)
CREATE TABLE IF NOT EXISTS astradio_users (
  id TEXT PRIMARY KEY,
  handle TEXT UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_users_handle ON astradio_users(handle);

-- Compat: charts (before user_primary_chart so FK can reference)
CREATE TABLE IF NOT EXISTS astradio_charts (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES astradio_users(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  timezone TEXT,
  snapshot_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_charts_owner ON astradio_charts(owner_id);

-- Primary chart per user (profile linkage)
CREATE TABLE IF NOT EXISTS astradio_user_primary_chart (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES astradio_users(id) ON DELETE CASCADE,
  chart_id TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compat: comparisons (optional V1)
CREATE TABLE IF NOT EXISTS astradio_comparisons (
  id TEXT PRIMARY KEY,
  chart_a_id TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  chart_b_id TEXT NOT NULL REFERENCES astradio_charts(id) ON DELETE CASCADE,
  relationship_mode TEXT NOT NULL,
  fusion_method TEXT NOT NULL,
  fusion_params JSONB NOT NULL DEFAULT '{}',
  merged_feature_vector64 JSONB NOT NULL DEFAULT '[]',
  merged_feature_hash TEXT,
  compatibility_text JSONB NOT NULL DEFAULT '{}',
  plan_hash TEXT NOT NULL,
  composition_id TEXT NOT NULL,
  export_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES astradio_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_astradio_comparisons_chart_a ON astradio_comparisons(chart_a_id);
CREATE INDEX IF NOT EXISTS idx_astradio_comparisons_created_by ON astradio_comparisons(created_by);

-- Community: groups
CREATE TABLE IF NOT EXISTS astradio_groups (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_groups_slug ON astradio_groups(slug);
CREATE INDEX IF NOT EXISTS idx_astradio_groups_tags ON astradio_groups USING GIN(tags);

-- Community: memberships
CREATE TABLE IF NOT EXISTS astradio_memberships (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES astradio_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  chart_id TEXT REFERENCES astradio_charts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_astradio_memberships_group ON astradio_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_astradio_memberships_user ON astradio_memberships(user_id);

-- Community: posts
CREATE TABLE IF NOT EXISTS astradio_posts (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES astradio_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_posts_group ON astradio_posts(group_id);

-- Community: comments
CREATE TABLE IF NOT EXISTS astradio_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES astradio_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES astradio_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_comments_post ON astradio_comments(post_id);

-- Community: reports
CREATE TABLE IF NOT EXISTS astradio_reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exports: job metadata; file stored on filesystem or object storage
CREATE TABLE IF NOT EXISTS astradio_export_jobs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  user_id TEXT REFERENCES astradio_users(id) ON DELETE SET NULL,
  plan_hash TEXT,
  chart_hash TEXT,
  file_path TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'audio/wav',
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_astradio_export_jobs_request ON astradio_export_jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_astradio_export_jobs_user ON astradio_export_jobs(user_id);
