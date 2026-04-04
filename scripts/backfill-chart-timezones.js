#!/usr/bin/env node
/**
 * Backfill / repair astradio_charts.timezone using lib/chart-timezone-resolve (same logic as INSERT).
 *
 * Modes (exactly one target set per run):
 *   Default / --null-only: only rows with timezone IS NULL (original behavior).
 *   --utc-placeholders: rows with UTC-equivalent placeholder saved with valid lat/lon.
 *
 *   POSTGRES_URL=... node scripts/backfill-chart-timezones.js [--dry-run] [--null-only]
 *   POSTGRES_URL=... node scripts/backfill-chart-timezones.js --utc-placeholders [--execute] [--dry-run] [--refresh-vectors]
 *
 *   --utc-placeholders defaults to dry-run (no DB writes). Pass --execute to apply updates.
 *
 * --refresh-vectors: after real updates, re-run populateChartVector for each updated chart (requires npm run vnext:build).
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { resolveChartTimezoneForChartInsert } = require('../lib/chart-timezone-resolve');

const POSTGRES_URL = process.env.POSTGRES_URL;
const utcMode = process.argv.includes('--utc-placeholders');
const forceDryRun = process.argv.includes('--dry-run');
const utcExecute = process.argv.includes('--execute');
/** Legacy null backfill writes by default; UTC-placeholder repair is dry-run until --execute. */
const dryRun = forceDryRun || (utcMode && !utcExecute);
const refreshVectors = process.argv.includes('--refresh-vectors') && !dryRun;

const UTC_PLACEHOLDER_SQL = `(
  timezone = 'UTC' OR timezone = 'Etc/UTC' OR timezone = 'GMT'
  OR timezone = 'Etc/GMT' OR timezone = 'Etc/GMT+0' OR timezone = 'Etc/GMT-0'
)`;

async function main() {
  if (!POSTGRES_URL) {
    console.error('POSTGRES_URL is required.');
    process.exit(1);
  }

  if (refreshVectors && utcMode) {
    const distVc = path.join(__dirname, '..', 'dist', 'vnext', 'vnext', 'compat', 'vector-cache.js');
    if (!fs.existsSync(distVc)) {
      console.error('[repair] --refresh-vectors requires dist; run: npm run vnext:build');
      process.exit(1);
    }
  }

  const pool = new Pool({ connectionString: POSTGRES_URL });
  const selectSql = utcMode
    ? `
    SELECT id, lat, lon, timezone
    FROM astradio_charts
    WHERE ${UTC_PLACEHOLDER_SQL}
      AND lat IS NOT NULL AND lon IS NOT NULL
    ORDER BY id ASC
  `
    : `
    SELECT id, lat, lon, timezone
    FROM astradio_charts
    WHERE timezone IS NULL
    ORDER BY id ASC
  `;

  const { rows } = await pool.query(selectSql);
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];
  const updatedIds = [];

  console.log(
    JSON.stringify({
      phase: utcMode ? 'chart_timezone_utc_placeholder_repair' : 'chart_timezone_null_backfill',
      resolver: 'chart-timezone-resolve',
      dryRun,
      refreshVectors: refreshVectors && utcMode,
      pendingCount: rows.length,
    }),
  );

  for (const row of rows) {
    const { id, lat, lon, timezone: existingTz } = row;
    try {
      const resolved = resolveChartTimezoneForChartInsert({
        timezone: existingTz,
        lat: Number(lat),
        lon: Number(lon),
      });
      if (resolved === existingTz) {
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log(JSON.stringify({ id, action: 'would_update', from: existingTz, to: resolved }));
        updated++;
        updatedIds.push(id);
        continue;
      }
      await pool.query(
        `UPDATE astradio_charts SET timezone = $1, snapshot_hash = NULL, updated_at = NOW() WHERE id = $2`,
        [resolved, id],
      );
      console.log(JSON.stringify({ id, action: 'updated', from: existingTz, to: resolved }));
      updated++;
      updatedIds.push(id);
    } catch (e) {
      failed++;
      const err = e instanceof Error ? e : new Error(String(e));
      failures.push({ id, code: err.code, message: err.message });
      console.warn(JSON.stringify({ id, action: 'skipped', code: err.code, message: err.message }));
    }
  }

  await pool.end();

  if (refreshVectors && utcMode && updatedIds.length > 0) {
    const storageMod = require(path.join(__dirname, '..', 'dist', 'vnext', 'vnext', 'compat', 'storage'));
    const pgStore = require(path.join(__dirname, '..', 'lib', 'pg-store'));
    storageMod.setStorage(pgStore);
    const { populateChartVector } = require(path.join(
      __dirname,
      '..',
      'dist',
      'vnext',
      'vnext',
      'compat',
      'vector-cache',
    ));
    for (const chartId of updatedIds) {
      try {
        await populateChartVector(chartId);
        console.log(JSON.stringify({ chartId, action: 'vector_refreshed' }));
      } catch (ve) {
        console.warn(
          JSON.stringify({
            chartId,
            action: 'vector_refresh_failed',
            message: ve instanceof Error ? ve.message : String(ve),
          }),
        );
      }
    }
  }

  console.log(
    JSON.stringify({
      phase: utcMode ? 'chart_timezone_utc_placeholder_repair' : 'chart_timezone_null_backfill',
      summary: {
        processed: rows.length,
        updatedOrWould: updated,
        skipped,
        failed,
        dryRun,
        vectorsRefreshed: refreshVectors && utcMode,
      },
      failures: failures.slice(0, 50),
      failuresTruncated: failures.length > 50,
    }),
  );

  if (failed > 0 && !dryRun) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
