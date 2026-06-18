#!/usr/bin/env node
/**
 * Mark DM conversations inactive after 180 days without messages.
 * Run manually: node vnext/scripts/purge-inactive-conversations.mjs
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

const SQL = `
UPDATE dm_conversations
SET status = 'inactive', updated_at = NOW()
WHERE status = 'active'
  AND last_message_at < NOW() - INTERVAL '180 days';
`;

async function main() {
  const res = await pool.query(SQL);
  console.log(`[purge-inactive-conversations] updated ${res.rowCount || 0} conversation(s)`);
  await pool.end();
}

main().catch((e) => {
  console.error('[purge-inactive-conversations] failed:', e?.message || e);
  process.exit(1);
});
