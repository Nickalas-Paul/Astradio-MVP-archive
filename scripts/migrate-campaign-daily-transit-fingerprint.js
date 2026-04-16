#!/usr/bin/env node
/**
 * One-time data migration: recompute `campaign_daily_state.transit_context_fingerprint`
 * using Campaign-only day fingerprint (canonical location + calendar_date, no clock time).
 * Aligns `daily_state_json.meta.transit_context_fingerprint` when present and refreshes
 * `daily_state_hash` to match updated JSON.
 *
 * Prerequisites: POSTGRES_URL (or TARGET_DB_URL)
 *
 * Deploy order: run this script once against the same DB as the engine, in the same release
 * window as deploying `server/routes/campaign-daily.js` changes, so incomplete-row paths
 * do not see mixed fingerprint modes.
 */
const { Client } = require('pg');
const { campaignDailyTransitContextFingerprint } = require('../server/lib/campaign-daily-transit-fingerprint');
const { canonicalJson, sha256 } = require('../server/lib/canonical-location');

const DB = process.env.POSTGRES_URL || process.env.TARGET_DB_URL;
if (!DB) {
  console.error(JSON.stringify({ error: 'POSTGRES_URL or TARGET_DB_URL required' }));
  process.exit(2);
}

function asObject(json) {
  if (!json) return null;
  if (typeof json === 'object' && json !== null) return json;
  if (typeof json === 'string') {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  const ssl = DB.includes('render.com') ? { rejectUnauthorized: false } : undefined;
  const c = new Client({ connectionString: DB, ssl });
  await c.connect();

  const { rows } = await c.query(`
    SELECT campaign_id, calendar_date::text AS calendar_date, engine_version,
           transit_context_json, daily_state_json, transit_context_fingerprint AS old_fp
    FROM campaign_daily_state
    ORDER BY campaign_id, calendar_date, engine_version
  `);

  let updated = 0;
  for (const row of rows) {
    const loc = asObject(row.transit_context_json);
    if (!loc || typeof loc.lat !== 'number') {
      console.error('[migrate-campaign-daily-fp] skip bad row', row.campaign_id, row.calendar_date);
      continue;
    }
    const newFp = campaignDailyTransitContextFingerprint(loc, row.calendar_date);
    const base = asObject(row.daily_state_json) || {};
    let nextJson = base;
    if (base.meta && typeof base.meta === 'object' && 'transit_context_fingerprint' in base.meta) {
      nextJson = {
        ...base,
        meta: {
          ...base.meta,
          transit_context_fingerprint: newFp,
        },
      };
    }
    const nextHash = sha256(canonicalJson(nextJson));
    await c.query(
      `UPDATE campaign_daily_state
       SET transit_context_fingerprint = $1,
           daily_state_json = $2::jsonb,
           daily_state_hash = $3
       WHERE campaign_id = $4 AND calendar_date = $5::date AND engine_version = $6`,
      [newFp, JSON.stringify(nextJson), nextHash, row.campaign_id, row.calendar_date, row.engine_version]
    );
    updated += 1;
  }

  await c.end();
  console.log(JSON.stringify({ ok: true, rows_scanned: rows.length, rows_updated: updated }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
