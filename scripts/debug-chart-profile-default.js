/**
 * One-off debug: users tied to chart_profile_default / directory eligibility.
 * Usage: DATABASE_URL=... node scripts/debug-chart-profile-default.js
 */
const { Pool } = require('pg');

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('Set DATABASE_URL or POSTGRES_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 20000 });

const q1 = `
SELECT
  u.id AS user_id,
  u.handle,
  u.display_name,
  u.discoverable_as,
  pc.chart_id AS primary_chart_id
FROM astradio_users u
LEFT JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
WHERE pc.chart_id = 'chart_profile_default'
   OR pc.chart_id IS NULL`;

const q2 = `
SELECT id, owner_id, label, date, time, lat, lon, timezone
FROM astradio_charts
WHERE id = 'chart_profile_default'`;

const q3 = `
SELECT
  u.id AS user_id,
  u.handle,
  u.display_name,
  u.discoverable_as,
  u.discoverable,
  pc.chart_id AS primary_chart_id,
  c.date,
  c.time,
  c.lat,
  c.lon
FROM astradio_users u
LEFT JOIN astradio_user_primary_chart pc ON u.id = pc.user_id
LEFT JOIN astradio_charts c ON pc.chart_id = c.id
WHERE u.discoverable = true
ORDER BY u.id`;

async function main() {
  console.log('=== Query 1: primary = chart_profile_default OR no primary row ===\n');
  const r1 = await pool.query(q1);
  console.table(r1.rows);

  console.log('\n=== Query 2: chart_profile_default row ===\n');
  const r2 = await pool.query(q2);
  console.table(r2.rows);

  console.log('\n=== Query 3: discoverable=true users + primary chart coords ===\n');
  const r3 = await pool.query(q3);
  console.log('row count:', r3.rows.length);
  console.table(r3.rows);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
