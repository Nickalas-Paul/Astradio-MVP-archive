#!/usr/bin/env node
/**
 * Run SQL migrations from migrations/ in order.
 * Uses POSTGRES_URL. Skips if not set.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.warn('POSTGRES_URL not set; skipping migrations.');
  process.exit(0);
}

const { Pool } = require('pg');
const needsSsl =
  process.env.PGSSLMODE === 'require' ||
  /render\.com|amazonaws\.com|rds\.amazonaws/i.test(POSTGRES_URL || '');
const pool = new Pool({
  connectionString: POSTGRES_URL,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
const migrationsDir = path.join(__dirname, '..', 'migrations');

async function run() {
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log('Running migration:', file);
    await pool.query(sql);
  }
  await pool.end();
  console.log('Migrations complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
