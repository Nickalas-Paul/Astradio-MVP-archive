#!/usr/bin/env node
/**
 * Backfill astradio_charts.snapshot_json from ephemeris (architecture-engine).
 *
 *   POSTGRES_URL=... node scripts/backfill-chart-snapshots.js
 *   POSTGRES_URL=... API_BASE_URL=https://your-engine.onrender.com node scripts/backfill-chart-snapshots.js
 *
 * Render Postgres uses TLS from Node (handled when URL matches render.com / sslmode=require).
 * chart-snapshot HTTP: defaults to localhost; set API_BASE_URL to a running engine if swisseph is not available locally.
 *
 * Requires: npm run vnext:build (dist/vnext/vnext/core/architecture-engine.js).
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const POSTGRES_URL = process.env.POSTGRES_URL;

/** Render / managed Postgres typically require TLS from Node clients. */
function pgPoolOptions(connectionString) {
  const remote =
    /render\.com|neon\.tech|supabase\.co|amazonaws\.com|rds\.amazonaws/i.test(connectionString) ||
    /sslmode=require/i.test(connectionString);
  return remote
    ? { connectionString, ssl: { rejectUnauthorized: false } }
    : { connectionString };
}

const aePath = path.join(__dirname, '..', 'dist', 'vnext', 'vnext', 'core', 'architecture-engine.js');

const DELAY_MS = 150;

async function main() {
  if (!POSTGRES_URL) {
    console.error('POSTGRES_URL is required.');
    process.exit(1);
  }
  if (!fs.existsSync(aePath)) {
    console.error('[backfill] Missing compiled architecture-engine. Run: npm run vnext:build');
    console.error('Expected:', aePath);
    process.exit(1);
  }

  const { fetchChartSnapshot } = require(aePath);
  const pool = new Pool(pgPoolOptions(POSTGRES_URL));

  console.log('Starting chart snapshot backfill...\n');

  const { rows: charts } = await pool.query(`
    SELECT id, date, time, lat, lon, timezone
    FROM astradio_charts
    WHERE snapshot_json IS NULL
    ORDER BY created_at DESC NULLS LAST, id ASC
  `);

  console.log(`Found ${charts.length} charts needing snapshots\n`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < charts.length; i++) {
    const chart = charts[i];
    const progress = `[${i + 1}/${charts.length}]`;

    try {
      console.log(`${progress} Computing snapshot for chart ${chart.id}...`);

      const snapshot = await fetchChartSnapshot({
        date: chart.date,
        time: chart.time,
        lat: chart.lat,
        lon: chart.lon,
        timezone: chart.timezone || 'UTC',
      });

      await pool.query(
        `UPDATE astradio_charts
         SET snapshot_json = $1::jsonb,
             snapshot_computed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(snapshot), chart.id]
      );

      successCount++;
      console.log(`${progress} Success\n`);

      if (i < charts.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    } catch (err) {
      errorCount++;
      const msg = `${progress} Failed for ${chart.id}: ${err.message}`;
      console.error(msg + '\n');
      errors.push({ chartId: chart.id, error: err.message });
    }
  }

  console.log('\nBackfill summary:');
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\nFailed charts:');
    errors.forEach((e) => console.log(`  - ${e.chartId}: ${e.error}`));
  }

  const { rows: remaining } = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM astradio_charts
    WHERE snapshot_json IS NULL
  `);
  console.log(`\nCharts still missing snapshots: ${remaining[0]?.count ?? 0}`);

  await pool.end();
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
