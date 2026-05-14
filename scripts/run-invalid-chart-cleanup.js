/**
 * One-off: Step 1 list suspect charts, Step 2 delete users on those primaries,
 * Step 3 verify discoverable+suspect, Step 4 count valid discoverable.
 * Usage: DATABASE_URL="postgresql://..." node scripts/run-invalid-chart-cleanup.js
 */
const { Pool } = require('pg');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('Set DATABASE_URL');
  process.exit(1);
}

const step1 = `
SELECT
  c.id AS chart_id,
  c.owner_id,
  c.label,
  c.date,
  COUNT(pc.user_id)::int AS users_using_this_chart
FROM astradio_charts c
LEFT JOIN astradio_user_primary_chart pc ON c.id = pc.chart_id
WHERE
  c.id LIKE '%default%'
  OR c.id LIKE '%phase%'
  OR c.id LIKE '%test%'
  OR c.id LIKE '%placeholder%'
  OR c.id LIKE '%real_chart%'
  OR c.owner_id IS NULL
GROUP BY c.id, c.owner_id, c.label, c.date
ORDER BY users_using_this_chart DESC`;

const step2 = `
DELETE FROM astradio_users
WHERE id IN (
  SELECT u.id
  FROM astradio_users u
  INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
  INNER JOIN astradio_charts c ON pc.chart_id = c.id
  WHERE
    c.id LIKE '%default%'
    OR c.id LIKE '%phase%'
    OR c.id LIKE '%test%'
    OR c.id LIKE '%placeholder%'
    OR c.id LIKE '%real_chart%'
)`;

const step3 = `
SELECT
  u.id,
  u.display_name,
  pc.chart_id,
  c.date
FROM astradio_users u
INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
INNER JOIN astradio_charts c ON pc.chart_id = c.id
WHERE
  u.discoverable = true
  AND (
    c.id LIKE '%default%'
    OR c.id LIKE '%phase%'
    OR c.id LIKE '%test%'
    OR c.id LIKE '%placeholder%'
    OR c.id LIKE '%real_chart%'
  )`;

const step4 = `
SELECT COUNT(*)::int AS valid_discoverable_users
FROM astradio_users u
INNER JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
INNER JOIN astradio_charts c ON pc.chart_id = c.id
WHERE
  u.discoverable = true
  AND c.id NOT LIKE '%default%'
  AND c.id NOT LIKE '%phase%'
  AND c.id NOT LIKE '%test%'
  AND c.id NOT LIKE '%placeholder%'
  AND c.id NOT LIKE '%real_chart%'
  AND c.id IS NOT NULL`;

async function main() {
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 25000,
    ssl: /localhost/i.test(url) ? false : { rejectUnauthorized: false },
  });
  try {
    console.log('=== Step 1: Suspect charts (placeholder patterns OR no owner) ===\n');
    const r1 = await pool.query(step1);
    console.table(r1.rows);
    console.log('row count:', r1.rows.length);

    console.log('\n=== Step 2: DELETE users whose primary matches suspect chart id patterns ===\n');
    const r2 = await pool.query(step2);
    console.log('deleted users:', r2.rowCount);

    console.log('\n=== Step 3: Discoverable users still on suspect primary charts ===\n');
    const r3 = await pool.query(step3);
    console.table(r3.rows);
    console.log('row count (expect 0):', r3.rows.length);

    console.log('\n=== Step 4: Valid discoverable user count ===\n');
    const r4 = await pool.query(step4);
    console.table(r4.rows);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
