#!/usr/bin/env node
/**
 * Remove QA seed signals from production (one-time cleanup).
 * Run manually: node vnext/scripts/cleanup-qa-signals.mjs
 */
require('dotenv').config();

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('POSTGRES_URL not set');
  process.exit(1);
}

const { Pool } = require('pg');
const needsSsl =
  process.env.PGSSLMODE === 'require' ||
  /render\.com|amazonaws\.com|rds\.amazonaws/i.test(POSTGRES_URL || '');
const pool = new Pool({
  connectionString: POSTGRES_URL,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

const IDS = [
  'sig_qa_community_signals_seed_v1',
  'sig_a920281d0e727618',
  'sig_57c47dd340f3ca51',
];

const SQL = `DELETE FROM astradio_signals WHERE id = ANY($1::text[])`;

async function main() {
  const res = await pool.query(SQL, [IDS]);
  console.log(`[cleanup-qa-signals] deleted ${res.rowCount || 0} signal row(s)`);
  await pool.end();
}

main().catch((e) => {
  console.error('[cleanup-qa-signals] failed:', e?.message || e);
  process.exit(1);
});
