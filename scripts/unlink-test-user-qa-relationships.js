#!/usr/bin/env node
/**
 * Rollback QA compat relationship links created by the seed utility.
 * Deletes only rows scoped to:
 * - label = "QA Connection"
 * - pair (chart_15bb1c43bf962c73, qa_compat_chart_*)
 * - owner_user_id in {usr_ff0e0495d46e1846, qa_compat_user_*}
 *
 * Requires: POSTGRES_URL or DATABASE_URL
 * Command:  node scripts/unlink-test-user-qa-relationships.js
 */

const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TEST_USER_ID = 'usr_ff0e0495d46e1846';
const TEST_CHART_ID = 'chart_15bb1c43bf962c73';
const LABEL = 'QA Connection';

async function main() {
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!pgUrl) {
    console.error('[unlink-test-user-qa-relationships] POSTGRES_URL or DATABASE_URL is required.');
    process.exit(1);
  }

  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const del = await client.query(
      `DELETE FROM astradio_relationships r
       USING astradio_charts qc
       WHERE r.label = $1
         AND qc.id LIKE 'qa_compat_chart_%'
         AND (
           (r.chart_id_low = $2 AND r.chart_id_high = qc.id) OR
           (r.chart_id_high = $2 AND r.chart_id_low = qc.id)
         )
         AND (
           r.owner_user_id = $3 OR
           r.owner_user_id LIKE 'qa_compat_user_%'
         )`,
      [LABEL, TEST_CHART_ID, TEST_USER_ID]
    );
    console.log(
      '[unlink-test-user-qa-relationships] Deleted rows:',
      del.rowCount
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[unlink-test-user-qa-relationships] Failed:', err);
  process.exit(1);
});
