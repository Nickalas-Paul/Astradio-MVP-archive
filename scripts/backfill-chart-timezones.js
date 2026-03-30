#!/usr/bin/env node
/**
 * Backfill astradio_charts.timezone where NULL, using lib/chart-timezone-resolve
 * (same logic as chart INSERT). Idempotent: only updates rows with timezone IS NULL.
 *
 *   POSTGRES_URL=... node scripts/backfill-chart-timezones.js
 *   POSTGRES_URL=... node scripts/backfill-chart-timezones.js --dry-run
 */
require('dotenv').config();

const { Pool } = require('pg');
const { resolveChartTimezoneForChartInsert } = require('../lib/chart-timezone-resolve');

const POSTGRES_URL = process.env.POSTGRES_URL;
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (!POSTGRES_URL) {
    console.error('POSTGRES_URL is required.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: POSTGRES_URL });
  const selectSql = `
    SELECT id, lat, lon, timezone
    FROM astradio_charts
    WHERE timezone IS NULL
    ORDER BY id ASC
  `;

  const { rows } = await pool.query(selectSql);
  let updated = 0;
  let failed = 0;
  const failures = [];

  console.log(
    JSON.stringify({
      phase: 'chart_timezone_backfill',
      resolver: 'chart-timezone-resolve',
      dryRun,
      pendingCount: rows.length,
    })
  );

  for (const row of rows) {
    const { id, lat, lon } = row;
    try {
      const resolved = resolveChartTimezoneForChartInsert({
        lat: Number(lat),
        lon: Number(lon),
      });
      if (dryRun) {
        console.log(JSON.stringify({ id, action: 'would_update', timezone: resolved }));
        updated++;
        continue;
      }
      await pool.query(
        `UPDATE astradio_charts SET timezone = $1, updated_at = NOW() WHERE id = $2 AND timezone IS NULL`,
        [resolved, id]
      );
      console.log(JSON.stringify({ id, action: 'updated', timezone: resolved }));
      updated++;
    } catch (e) {
      failed++;
      const err = e instanceof Error ? e : new Error(String(e));
      failures.push({ id, code: err.code, message: err.message });
      console.warn(JSON.stringify({ id, action: 'skipped', code: err.code, message: err.message }));
    }
  }

  await pool.end();

  console.log(
    JSON.stringify({
      phase: 'chart_timezone_backfill',
      summary: { processed: rows.length, updatedOrWould: updated, failed, dryRun },
      failures: failures.slice(0, 50),
      failuresTruncated: failures.length > 50,
    })
  );

  if (failed > 0 && !dryRun) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
