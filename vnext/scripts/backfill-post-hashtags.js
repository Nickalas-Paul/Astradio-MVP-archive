#!/usr/bin/env node
/**
 * Backfill community_post_hashtags and community_threads from existing post bodies.
 * Usage: POSTGRES_URL=... node vnext/scripts/backfill-post-hashtags.js
 */
require('dotenv').config();

const { extractHashtags } = require('../../lib/community-hashtag-utils');

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error('POSTGRES_URL required');
    process.exit(1);
  }
  const pgStore = require('../../lib/pg-store');
  const { Pool } = require('pg');
  const needsSsl =
    process.env.PGSSLMODE === 'require' ||
    /render\.com|amazonaws\.com|rds\.amazonaws/i.test(url);
  const pool = new Pool({
    connectionString: url,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  const { rows } = await pool.query(
    `SELECT id, body FROM community_posts ORDER BY created_at ASC`
  );
  console.log(`Processing ${rows.length} posts...`);

  let withTags = 0;
  for (const row of rows) {
    const tags = extractHashtags(row.body || '');
    if (!tags.length) continue;
    await pgStore.insertPostHashtags(row.id, tags);
    withTags += 1;
    console.log(`  ${row.id}: ${tags.join(', ')}`);
  }

  console.log(`Done. ${withTags} posts with hashtags.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
