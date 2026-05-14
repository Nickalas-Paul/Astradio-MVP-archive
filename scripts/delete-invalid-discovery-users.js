/**
 * Direct cleanup: invalid discovery-related users per Phase cleanup spec.
 * Usage: DATABASE_URL=... node scripts/delete-invalid-discovery-users.js
 */
const { Pool } = require('pg');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('Set DATABASE_URL or POSTGRES_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 30000 });

const step1 = `
DELETE FROM astradio_users
WHERE id IN (
  SELECT u.id
  FROM astradio_users u
  INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
  WHERE pc.chart_id = 'chart_profile_default'
)`;

const step2 = `
DELETE FROM astradio_users
WHERE id NOT IN (
  SELECT user_id FROM astradio_user_primary_chart
)`;

const step3 = `
DELETE FROM astradio_users
WHERE id IN (
  SELECT u.id
  FROM astradio_users u
  INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
  INNER JOIN astradio_charts c ON pc.chart_id = c.id
  WHERE (c.lat = 0 AND c.lon = 0)
     OR (c.lat = 1 AND c.lon = 1)
)`;

const verify = `
SELECT
  COUNT(*)::int AS total_discoverable,
  COUNT(DISTINCT pc.chart_id)::int AS unique_charts
FROM astradio_users u
INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
INNER JOIN astradio_charts c ON pc.chart_id = c.id
WHERE u.discoverable = true
  AND pc.chart_id != 'chart_profile_default'
  AND pc.chart_id IS NOT NULL
  AND NOT (c.lat = 0 AND c.lon = 0)
  AND NOT (c.lat = 1 AND c.lon = 1)`;

const checkDefaultPrimary = `
SELECT COUNT(*)::int AS cnt
FROM astradio_users u
INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
WHERE pc.chart_id = 'chart_profile_default'`;

async function main() {
  const client = await pool.connect();
  try {
    console.log('--- Step 1: DELETE users with primary chart_profile_default ---');
    const r1 = await client.query(step1);
    console.log('deleted:', r1.rowCount);

    console.log('\n--- Step 2: DELETE users with no primary chart row ---');
    const r2 = await client.query(step2);
    console.log('deleted:', r2.rowCount);

    console.log('\n--- Step 3: DELETE users with primary chart (0,0) or (1,1) ---');
    const r3 = await client.query(step3);
    console.log('deleted:', r3.rowCount);

    console.log('\n--- Step 4: Verify discoverable + valid charts ---');
    const r4 = await client.query(verify);
    console.table(r4.rows);

    console.log('\n--- Confirmation: users still on chart_profile_default primary ---');
    const r5 = await client.query(checkDefaultPrimary);
    console.table(r5.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
