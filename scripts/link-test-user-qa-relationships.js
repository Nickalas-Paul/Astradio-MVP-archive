#!/usr/bin/env node
/**
 * Link test user to QA compat peers for relational feed.
 * - Deterministic: discovers qa_compat_user_* with qa_compat_chart_* and stable sort.
 * - Idempotent: ON CONFLICT DO NOTHING on astradio_relationships unique key.
 * - Safe by default: refuses NODE_ENV=production unless QA_ALLOW_PROD_SEED=1.
 *
 * Requires: POSTGRES_URL or DATABASE_URL
 * Command:  node scripts/link-test-user-qa-relationships.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const TEST_USER_ID = 'usr_ff0e0495d46e1846';
const TEST_CHART_ID = 'chart_15bb1c43bf962c73';

const LABEL = 'QA Connection';
const REQUIRED_QA_USERS = [
  'qa_compat_user_10',
  'qa_compat_user_11',
  'qa_compat_user_12',
  'qa_compat_user_14',
];

function canonicalPair(a, b) {
  const lo = String(a).localeCompare(String(b), 'en') <= 0 ? String(a) : String(b);
  const hi = lo === String(a) ? String(b) : String(a);
  return [lo, hi];
}

async function insertRelationship(client, ownerUserId, chartAId, chartBId) {
  const [chartIdLow, chartIdHigh] = canonicalPair(chartAId, chartBId);
  const idRes = await client.query("SELECT 'rel_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16) AS id");
  const id = idRes.rows[0]?.id;
  const ins = await client.query(
    `INSERT INTO astradio_relationships
      (id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NULL, NOW(), NOW())
     ON CONFLICT (owner_user_id, chart_id_low, chart_id_high, label) DO NOTHING`,
    [id, ownerUserId, chartIdLow, chartIdHigh, LABEL]
  );
  return ins.rowCount === 1;
}

async function discoverQaPeers(client) {
  const res = await client.query(
    `SELECT u.id AS user_id, c.id AS chart_id
     FROM astradio_users u
     JOIN astradio_charts c ON c.owner_id = u.id
     WHERE u.id LIKE 'qa_compat_user_%'
       AND c.id LIKE 'qa_compat_chart_%'
     ORDER BY u.id ASC, c.id ASC`
  );
  const byUser = new Map();
  for (const row of res.rows) {
    const userId = String(row.user_id || '').trim();
    const chartId = String(row.chart_id || '').trim();
    if (!userId || !chartId) continue;
    if (!byUser.has(userId)) byUser.set(userId, chartId);
  }
  return Array.from(byUser.entries())
    .map(([userId, chartId]) => ({ userId, chartId }))
    .sort((a, b) => a.userId.localeCompare(b.userId, 'en'));
}

async function main() {
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!pgUrl) {
    console.error('[link-test-user-qa-relationships] POSTGRES_URL or DATABASE_URL is required.');
    process.exit(1);
  }
  if (!process.env.POSTGRES_URL) {
    process.env.POSTGRES_URL = pgUrl;
  }

  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production' && process.env.QA_ALLOW_PROD_SEED !== '1') {
    console.error(
      '[link-test-user-qa-relationships] Refusing to run in production without QA_ALLOW_PROD_SEED=1.'
    );
    process.exit(1);
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  const summary = {
    created: 0,
    alreadyExisted: 0,
    skipped: [],
  };

  try {
    const testChart = await client.query(
      'SELECT id, owner_id FROM astradio_charts WHERE id = $1 LIMIT 1',
      [TEST_CHART_ID]
    );
    if (testChart.rowCount !== 1 || testChart.rows[0].owner_id !== TEST_USER_ID) {
      throw new Error(`test_user_or_chart_mismatch user=${TEST_USER_ID} chart=${TEST_CHART_ID}`);
    }

    const peers = await discoverQaPeers(client);
    if (peers.length === 0) {
      throw new Error('no_qa_compat_peers_found');
    }

    const requiredSet = new Set(REQUIRED_QA_USERS);
    for (const reqUser of REQUIRED_QA_USERS) {
      if (!peers.some((p) => p.userId === reqUser)) {
        summary.skipped.push({ userId: reqUser, reason: 'required_user_missing_or_no_valid_chart' });
      }
    }

    for (const peer of peers) {
      if (peer.userId === TEST_USER_ID) {
        summary.skipped.push({ userId: peer.userId, reason: 'self_user' });
        continue;
      }
      const createA = await insertRelationship(client, TEST_USER_ID, TEST_CHART_ID, peer.chartId);
      const createB = await insertRelationship(client, peer.userId, TEST_CHART_ID, peer.chartId);
      const createdRows = Number(createA) + Number(createB);
      if (createdRows > 0) {
        summary.created += createdRows;
      } else {
        summary.alreadyExisted += 2;
      }
      const requiredTag = requiredSet.has(peer.userId) ? 'required' : 'optional';
      console.log(
        '[link-test-user-qa-relationships]',
        peer.userId,
        peer.chartId,
        `(${requiredTag})`,
        createdRows > 0 ? 'created_or_partial' : 'already_exists'
      );
    }
  } finally {
    await client.end();
  }

  console.log('[link-test-user-qa-relationships] Summary', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('[link-test-user-qa-relationships] Failed:', err);
  process.exit(1);
});
