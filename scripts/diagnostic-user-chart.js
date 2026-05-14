/**
 * Diagnostic: logged-in user chart + directory candidates + invalid primary count.
 * Usage: DATABASE_URL="postgresql://..." node scripts/diagnostic-user-chart.js
 */
const { Pool } = require('pg');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('Set DATABASE_URL or POSTGRES_URL');
  process.exit(1);
}

const TARGET_USER = 'usr_ff0e0495d46e1846';

const q1 = `
SELECT
  u.id AS user_id,
  u.handle,
  u.display_name,
  pc.chart_id,
  c.date,
  c.time,
  c.lat,
  c.lon,
  c.timezone,
  c.owner_id,
  CASE
    WHEN c.id LIKE '%default%' THEN 'PLACEHOLDER'
    WHEN c.id LIKE '%phase%' THEN 'TEST CHART'
    WHEN c.date IS NULL THEN 'NO BIRTH DATA'
    ELSE 'VALID'
  END AS status
FROM astradio_users u
INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
INNER JOIN astradio_charts c ON pc.chart_id = c.id
WHERE u.id = $1`;

const q2 = `
SELECT
  u.id AS user_id,
  u.display_name,
  pc.chart_id,
  c.date,
  c.time,
  u.discoverable_as,
  CASE
    WHEN pc.chart_id LIKE '%phase%' THEN 'WILL_FAIL'
    WHEN pc.chart_id LIKE '%default%' THEN 'WILL_FAIL'
    WHEN c.date IS NULL THEN 'WILL_FAIL'
    ELSE 'OK'
  END AS match_status
FROM astradio_users u
INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
INNER JOIN astradio_charts c ON pc.chart_id = c.id
WHERE
  u.discoverable = true
  AND u.id != $1
  AND (u.discoverable_as = 'friends' OR u.discoverable_as = 'both')
LIMIT 10`;

const q3 = `
SELECT COUNT(*)::int AS remaining_invalid_users
FROM astradio_users u
INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
WHERE pc.chart_id LIKE '%phase%'
   OR pc.chart_id LIKE '%test%'
   OR pc.chart_id LIKE '%default%'`;

async function main() {
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 25000,
    ssl: /localhost/i.test(url) ? false : { rejectUnauthorized: false },
  });
  try {
    console.log('=== Query 1: Target user primary chart ===\n');
    const r1 = await pool.query(q1, [TARGET_USER]);
    console.table(r1.rows);
    if (r1.rows.length === 0) {
      console.log('(No row: user missing, no primary chart, or chart join failed.)\n');
    }

    console.log('=== Query 2: First 10 friend-mode directory candidates (exclude target) ===\n');
    const r2 = await pool.query(q2, [TARGET_USER]);
    console.table(r2.rows);

    console.log('=== Query 3: Count users with phase/test/default primary chart_id ===\n');
    const r3 = await pool.query(q3);
    console.table(r3.rows);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
