#!/usr/bin/env node
/**
 * Link test user to QA compat peers for relational feed (prepare-only — run only when approved).
 * Uses pgStore.createRelationship twice per peer (one row per owner_user_id). Label: QA Connection.
 * Idempotent via ON CONFLICT on astradio_relationships. Does not modify charts or vectors.
 *
 * Requires: POSTGRES_URL or DATABASE_URL
 *   node scripts/link-test-user-qa-relationships.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TEST_USER_ID = 'usr_ff0e0495d46e1846';
const TEST_CHART_ID = 'chart_15bb1c43bf962c73';

const QA_PEERS = [
  { userId: 'qa_compat_user_10', chartId: 'qa_compat_chart_10' },
  { userId: 'qa_compat_user_11', chartId: 'qa_compat_chart_11' },
  { userId: 'qa_compat_user_12', chartId: 'qa_compat_chart_12' },
  { userId: 'qa_compat_user_14', chartId: 'qa_compat_chart_14' },
];

const LABEL = 'QA Connection';

async function main() {
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!pgUrl) {
    console.error('[link-test-user-qa-relationships] POSTGRES_URL or DATABASE_URL is required.');
    process.exit(1);
  }
  if (!process.env.POSTGRES_URL) {
    process.env.POSTGRES_URL = pgUrl;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pgStore = require(path.join(__dirname, '..', 'lib', 'pg-store.js'));

  for (const peer of QA_PEERS) {
    await pgStore.createRelationship({
      ownerUserId: TEST_USER_ID,
      chartAId: TEST_CHART_ID,
      chartBId: peer.chartId,
      label: LABEL,
      comparisonId: null,
    });
    await pgStore.createRelationship({
      ownerUserId: peer.userId,
      chartAId: TEST_CHART_ID,
      chartBId: peer.chartId,
      label: LABEL,
      comparisonId: null,
    });
    console.log('[link-test-user-qa-relationships] Linked', TEST_USER_ID, '<->', peer.userId);
  }

  console.log('[link-test-user-qa-relationships] Complete (idempotent upserts).');
}

main().catch((err) => {
  console.error('[link-test-user-qa-relationships] Failed:', err);
  process.exit(1);
});
