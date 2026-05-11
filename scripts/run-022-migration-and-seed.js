/**
 * One-off: apply migrations/022_discovery_profile_fields.sql and seed usr_demo_* rows.
 * Usage: DATABASE_URL="postgres://..." node scripts/run-022-migration-and-seed.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('Set DATABASE_URL or POSTGRES_URL');
  process.exit(1);
}

const DEMO = [
  {
    id: 'usr_demo_1',
    bio: 'Creative developer exploring astrological patterns in human connection. Always up for deep conversations about cosmos and consciousness.',
    looking_for:
      'Looking for thoughtful friends who value authenticity and enjoy philosophical discussions about life, meaning, and the stars.',
    discoverable_as: 'friends',
  },
  {
    id: 'usr_demo_2',
    bio: 'Artist and stargazer seeking meaningful connections. Believer in cosmic timing and the magic of aligned energies.',
    looking_for:
      'Seeking a partner who values emotional depth, creative expression, and spiritual growth through shared experience.',
    discoverable_as: 'partners',
  },
  {
    id: 'usr_demo_3',
    bio: 'Astrology enthusiast, dog person, coffee addict. Work in tech but heart lives in the stars. Gemini sun, Pisces moon, Virgo rising.',
    looking_for:
      'Open to both friendships and romance with people who appreciate complexity, humor, and honest conversation.',
    discoverable_as: 'both',
  },
  {
    id: 'usr_demo_4',
    bio: 'Outdoor adventurer with a passion for understanding the cosmic influences on our daily lives. Trail runner meets chart reader.',
    looking_for:
      'Seeking adventure buddies and intellectually curious friends who can discuss philosophy over a good hike.',
    discoverable_as: 'friends',
  },
  {
    id: 'usr_demo_5',
    bio: 'Musician exploring the harmonics between celestial movements and human emotion. Scorpio energy with a Cancer heart.',
    looking_for:
      "Looking for a romantic partner who values emotional authenticity and is not afraid of deep transformation.",
    discoverable_as: 'partners',
  },
];

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const migPath = path.join(__dirname, '..', 'migrations', '022_discovery_profile_fields.sql');
    const sql = fs.readFileSync(migPath, 'utf8');
    console.log('Applying 022_discovery_profile_fields.sql ...');
    await client.query(sql);
    console.log('Migration 022 applied.');

    const idx = await client.query(
      `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_astradio_users_discoverable_as'`
    );
    console.log('Index idx_astradio_users_discoverable_as:', idx.rows.length ? 'yes' : 'missing');

    for (const row of DEMO) {
      const r = await client.query(
        `UPDATE astradio_users
         SET bio = $2, looking_for = $3, discoverable_as = $4, avatar_url = NULL
         WHERE id = $1`,
        [row.id, row.bio, row.looking_for, row.discoverable_as]
      );
      console.log('UPDATE', row.id, 'rowCount', r.rowCount);
    }

    const verify = await client.query(
      `SELECT id, display_name,
        LEFT(bio, 50) || '...' AS bio_preview,
        discoverable_as,
        LEFT(looking_for, 50) || '...' AS looking_for_preview
       FROM astradio_users
       WHERE id LIKE 'usr_demo_%'
       ORDER BY id`
    );
    console.log('\nusr_demo_* rows:');
    console.table(verify.rows);

    const sample = await client.query(
      `SELECT
         u.id,
         u.handle,
         u.display_name,
         u.email,
         u.bio,
         u.avatar_url,
         u.discoverable_as,
         u.looking_for,
         u.discoverable AS legacy_discoverable_flag,
         u.show_in_feed,
         u.created_at,
         c.id AS primary_chart_id,
         c.date AS birth_date,
         c.time AS birth_time,
         c.lat,
         c.lon,
         c.timezone
       FROM astradio_users u
       LEFT JOIN astradio_user_primary_chart upc ON u.id = upc.user_id
       LEFT JOIN astradio_charts c ON upc.chart_id = c.id
       WHERE u.id = 'usr_demo_1'`
    );
    console.log('\nSample profile usr_demo_1:');
    console.log(JSON.stringify(sample.rows[0] || null, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
