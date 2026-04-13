#!/usr/bin/env node
/**
 * **Product:Phase-6** — verify sandbox compositions table and read/write (includes **Acct:Stage-6** owner column when applied).
 * When POSTGRES_URL is set: ensure migration 006 applied, insert one row, list, get by id.
 * When not set: skip (exit 0).
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.log('SKIP: POSTGRES_URL not set');
  process.exit(0);
}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: POSTGRES_URL });

async function main() {
  const migrationPath = path.join(__dirname, '..', 'migrations', '006_phase6_sandbox_compositions.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await pool.query(sql);

  const id = require('crypto').randomUUID();
  const now = new Date().toISOString();
  const sandbox_state = { birth: { date: '1990-01-01', time: '12:00', lat: 0, lon: 0 }, overrides: { planets: {} }, controls: {} };
  const vector_hash = 'phase6-verify-' + id.slice(0, 8);
  const seed = vector_hash;
  const plan_hash = 'phase6-plan-hash-verify';
  const report = {};

  await pool.query(
    `INSERT INTO astradio_sandbox_compositions (id, sandbox_state, vector_hash, seed, plan_hash, report, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $7::timestamptz)`,
    [id, JSON.stringify(sandbox_state), vector_hash, seed, plan_hash, JSON.stringify(report), now]
  );

  const list = await pool.query(
    'SELECT id, plan_hash, vector_hash, created_at FROM astradio_sandbox_compositions ORDER BY created_at DESC LIMIT 10'
  );
  if (list.rows.length === 0) {
    console.error('FAIL: list empty after insert');
    process.exit(1);
  }

  const row = await pool.query('SELECT * FROM astradio_sandbox_compositions WHERE id = $1', [id]);
  if (row.rows.length !== 1 || row.rows[0].plan_hash !== plan_hash) {
    console.error('FAIL: get by id');
    process.exit(1);
  }

  await pool.end();
  console.log('OK: sandbox compositions — save/list/get');
}

main().catch((e) => {
  const refused = e.code === 'ECONNREFUSED' || (e.errors && e.errors[0]?.code === 'ECONNREFUSED') || e.message?.includes('ECONNREFUSED');
  if (refused) {
    console.log('SKIP: database not available (connection refused)');
    process.exit(0);
  }
  console.error(e);
  process.exit(1);
});
