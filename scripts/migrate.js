const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function createTables() {
  const client = await pool.connect();
  
  try {
    console.log('Creating database tables...');
    
    // Enable ULID extension
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);
    
    // Create ULID function
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_ulid()
      RETURNS text
      LANGUAGE plpgsql
      AS $$
      DECLARE
        timestamp  bigint;
        randomness bigint;
        result     text;
      BEGIN
        timestamp := (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;
        randomness := (random() * 9223372036854775807)::bigint;
        result := encode(
          (timestamp << 16) | (randomness & 65535),
          'base32'
        );
        RETURN result;
      END;
      $$;
    `);
    
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY DEFAULT generate_ulid(),
        email text UNIQUE NOT NULL,
        email_verified_at timestamptz,
        password_hash text,
        oauth_provider text CHECK (oauth_provider IN ('google', 'apple')),
        oauth_sub text,
        display_name text,
        username text UNIQUE,
        avatar_url text,
        bio text,
        location text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    
    // Profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        birth_datetime timestamptz,
        birth_lat double precision,
        birth_lon double precision,
        privacy_level text DEFAULT 'friends' CHECK (privacy_level IN ('public', 'friends', 'private')),
        compare_opt_in boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    
    // Follows table
    await client.query(`
      CREATE TABLE IF NOT EXISTS follows (
        follower_id text REFERENCES users(id) ON DELETE CASCADE,
        followee_id text REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz DEFAULT now(),
        PRIMARY KEY (follower_id, followee_id),
        CHECK (follower_id != followee_id)
      );
    `);
    
    // Tracks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id text PRIMARY KEY DEFAULT generate_ulid(),
        owner_id text REFERENCES users(id) ON DELETE SET NULL,
        mode text NOT NULL CHECK (mode IN ('clusters', 'elemental', 'lunar')),
        genre text NOT NULL,
        source text NOT NULL CHECK (source IN ('natal', 'transit', 'overlay')),
        chart_hash text NOT NULL,
        duration_sec int NOT NULL DEFAULT 60,
        key_signature text,
        bpm int,
        waveform_url text,
        preview_url text,
        og_image_url text,
        timeline_json jsonb NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE (owner_id, chart_hash, mode, genre)
      );
    `);
    
    // Libraries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS libraries (
        user_id text REFERENCES users(id) ON DELETE CASCADE,
        track_id text REFERENCES tracks(id) ON DELETE CASCADE,
        saved_at timestamptz DEFAULT now(),
        PRIMARY KEY (user_id, track_id)
      );
    `);
    
    // Likes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS likes (
        user_id text REFERENCES users(id) ON DELETE CASCADE,
        track_id text REFERENCES tracks(id) ON DELETE CASCADE,
        created_at timestamptz DEFAULT now(),
        PRIMARY KEY (user_id, track_id)
      );
    `);
    
    // Playlists table
    await client.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id text PRIMARY KEY DEFAULT generate_ulid(),
        owner_id text REFERENCES users(id) ON DELETE CASCADE,
        title text NOT NULL,
        description text,
        is_public boolean DEFAULT true,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    
    // Playlist items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        playlist_id text REFERENCES playlists(id) ON DELETE CASCADE,
        track_id text REFERENCES tracks(id) ON DELETE CASCADE,
        position int NOT NULL,
        added_at timestamptz DEFAULT now(),
        PRIMARY KEY (playlist_id, track_id)
      );
    `);
    
    // Comparisons table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comparisons (
        id text PRIMARY KEY DEFAULT generate_ulid(),
        requester_id text REFERENCES users(id) ON DELETE CASCADE,
        target_id text REFERENCES users(id) ON DELETE CASCADE,
        chart_hash text NOT NULL,
        result_track_id text REFERENCES tracks(id) ON DELETE SET NULL,
        created_at timestamptz DEFAULT now()
      );
    `);
    
    // Shares table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id text PRIMARY KEY DEFAULT generate_ulid(),
        track_id text REFERENCES tracks(id) ON DELETE CASCADE,
        user_id text REFERENCES users(id) ON DELETE CASCADE,
        platform text NOT NULL CHECK (platform IN ('x', 'instagram', 'facebook', 'tiktok', 'copy')),
        share_url text,
        created_at timestamptz DEFAULT now()
      );
    `);
    
    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id text PRIMARY KEY DEFAULT generate_ulid(),
        user_id text REFERENCES users(id) ON DELETE CASCADE,
        type text NOT NULL CHECK (type IN ('follow', 'like', 'save', 'compare_request', 'system')),
        payload jsonb NOT NULL,
        is_read boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      );
    `);
    
    // Blocks table for privacy
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        blocker_id text REFERENCES users(id) ON DELETE CASCADE,
        blocked_id text REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz DEFAULT now(),
        PRIMARY KEY (blocker_id, blocked_id),
        CHECK (blocker_id != blocked_id)
      );
    `);
    
    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_tracks_owner_id ON tracks(owner_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_chart_hash ON tracks(chart_hash);
      CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at);
      CREATE INDEX IF NOT EXISTS idx_libraries_user_id ON libraries(user_id);
      CREATE INDEX IF NOT EXISTS idx_likes_track_id ON likes(track_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    `);
    
    console.log('Database tables created successfully!');
    
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await createTables();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
