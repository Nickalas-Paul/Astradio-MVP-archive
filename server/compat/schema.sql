-- Compatibility Matching Database Schema
-- Append-only friendly schema for compatibility features

-- Users & charts (existing tables assumed)
-- CREATE TABLE users (id TEXT PRIMARY KEY, ...);
-- CREATE TABLE charts (id TEXT PRIMARY KEY, user_id TEXT, ...);

-- Compatibility profiles (one per user chart)
CREATE TABLE compat_profiles (
  user_id TEXT NOT NULL,
  chart_id TEXT NOT NULL,
  features64 REAL[] NOT NULL,      -- 64-D feature vector from engine encoder
  prefs JSONB,                     -- user preferences (energy, mood, etc.)
  visibility TEXT NOT NULL DEFAULT 'private', -- 'private', 'friends', 'public'
  encoder_version TEXT NOT NULL DEFAULT 'v1', -- for future encoder updates
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, chart_id)
);

-- Precomputed cache: Top-N per facet
CREATE TABLE compat_cache (
  chart_id TEXT NOT NULL,
  facet TEXT NOT NULL,
  rank INT NOT NULL,
  target_user_id TEXT NOT NULL,
  target_chart_id TEXT NOT NULL,
  score REAL NOT NULL,
  rationale JSONB,                 -- array of rationale strings
  preview_comp_id TEXT,            -- optional preview composition ID
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chart_id, facet, rank)
);

-- Pairwise audit (optional, for analysis/QA)
CREATE TABLE compat_pairs (
  a_chart_id TEXT NOT NULL,
  b_chart_id TEXT NOT NULL,
  facet TEXT NOT NULL,
  score REAL NOT NULL,
  rationale JSONB,
  syn_features JSONB,              -- detailed synastry features
  breakdown JSONB,                 -- scoring breakdown
  computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (a_chart_id, b_chart_id, facet)
);

-- User preferences for compatibility
CREATE TABLE compat_user_prefs (
  user_id TEXT NOT NULL,
  chart_id TEXT NOT NULL,
  energy REAL DEFAULT 0.5,         -- 0..1
  mood REAL DEFAULT 0.5,           -- 0..1
  complexity REAL DEFAULT 0.5,     -- 0..1
  novelty REAL DEFAULT 0.5,        -- 0..1
  stability REAL DEFAULT 0.5,      -- 0..1
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, chart_id)
);

-- Compatibility interactions (for ML training)
CREATE TABLE compat_interactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  chart_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  target_chart_id TEXT NOT NULL,
  facet TEXT NOT NULL,
  interaction_type TEXT NOT NULL,  -- 'view', 'like', 'play', 'share'
  score REAL,                      -- score at time of interaction
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Blocked users (for privacy)
CREATE TABLE compat_blocks (
  user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, blocked_user_id)
);

-- Indexes for performance
CREATE INDEX idx_compat_profiles_user_id ON compat_profiles(user_id);
CREATE INDEX idx_compat_profiles_chart_id ON compat_profiles(chart_id);
CREATE INDEX idx_compat_profiles_visibility ON compat_profiles(visibility);
CREATE INDEX idx_compat_profiles_updated_at ON compat_profiles(updated_at);

CREATE INDEX idx_compat_cache_chart_id ON compat_cache(chart_id);
CREATE INDEX idx_compat_cache_facet ON compat_cache(facet);
CREATE INDEX idx_compat_cache_score ON compat_cache(score DESC);
CREATE INDEX idx_compat_cache_updated_at ON compat_cache(updated_at);

CREATE INDEX idx_compat_pairs_a_chart_id ON compat_pairs(a_chart_id);
CREATE INDEX idx_compat_pairs_b_chart_id ON compat_pairs(b_chart_id);
CREATE INDEX idx_compat_pairs_facet ON compat_pairs(facet);
CREATE INDEX idx_compat_pairs_score ON compat_pairs(score DESC);
CREATE INDEX idx_compat_pairs_computed_at ON compat_pairs(computed_at);

CREATE INDEX idx_compat_interactions_user_id ON compat_interactions(user_id);
CREATE INDEX idx_compat_interactions_chart_id ON compat_interactions(chart_id);
CREATE INDEX idx_compat_interactions_target_user_id ON compat_interactions(target_user_id);
CREATE INDEX idx_compat_interactions_facet ON compat_interactions(facet);
CREATE INDEX idx_compat_interactions_type ON compat_interactions(interaction_type);
CREATE INDEX idx_compat_interactions_created_at ON compat_interactions(created_at);

CREATE INDEX idx_compat_blocks_user_id ON compat_blocks(user_id);
CREATE INDEX idx_compat_blocks_blocked_user_id ON compat_blocks(blocked_user_id);

-- Views for common queries
CREATE VIEW compat_public_profiles AS
SELECT 
  user_id,
  chart_id,
  features64,
  prefs,
  encoder_version,
  updated_at
FROM compat_profiles
WHERE visibility = 'public';

CREATE VIEW compat_friends_profiles AS
SELECT 
  user_id,
  chart_id,
  features64,
  prefs,
  encoder_version,
  updated_at
FROM compat_profiles
WHERE visibility IN ('public', 'friends');

-- Functions for common operations
CREATE OR REPLACE FUNCTION update_compat_profile(
  p_user_id TEXT,
  p_chart_id TEXT,
  p_features64 REAL[],
  p_prefs JSONB DEFAULT NULL,
  p_visibility TEXT DEFAULT 'private'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO compat_profiles (user_id, chart_id, features64, prefs, visibility, updated_at)
  VALUES (p_user_id, p_chart_id, p_features64, p_prefs, p_visibility, NOW())
  ON CONFLICT (user_id, chart_id)
  DO UPDATE SET
    features64 = EXCLUDED.features64,
    prefs = EXCLUDED.prefs,
    visibility = EXCLUDED.visibility,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION invalidate_compat_cache(p_chart_id TEXT)
RETURNS VOID AS $$
BEGIN
  DELETE FROM compat_cache WHERE chart_id = p_chart_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_compat_matches(
  p_chart_id TEXT,
  p_facet TEXT,
  p_limit INT DEFAULT 10
) RETURNS TABLE (
  target_user_id TEXT,
  target_chart_id TEXT,
  score REAL,
  rationale JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.target_user_id,
    cc.target_chart_id,
    cc.score,
    cc.rationale
  FROM compat_cache cc
  WHERE cc.chart_id = p_chart_id
    AND cc.facet = p_facet
  ORDER BY cc.rank
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic cache invalidation
CREATE OR REPLACE FUNCTION trigger_invalidate_compat_cache()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM invalidate_compat_cache(NEW.chart_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compat_profiles_update_trigger
  AFTER UPDATE ON compat_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invalidate_compat_cache();

-- Cleanup function for old cache entries
CREATE OR REPLACE FUNCTION cleanup_old_compat_cache()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM compat_cache 
  WHERE updated_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing
INSERT INTO compat_profiles (user_id, chart_id, features64, prefs, visibility) VALUES
('user-1', 'natal-1', ARRAY[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0, 0.1, 0.2, 0.3, 0.4], '{"energy": 0.7, "mood": 0.6, "complexity": 0.8}', 'public'),
('user-2', 'natal-2', ARRAY[-0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9, -1.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, -0.1, -0.2, -0.3, -0.4], '{"energy": 0.5, "mood": 0.8, "complexity": 0.6}', 'public'),
('user-3', 'natal-3', ARRAY[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], '{"energy": 0.6, "mood": 0.7, "complexity": 0.5}', 'friends');
