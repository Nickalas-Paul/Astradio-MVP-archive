#!/usr/bin/env node
/**
 * QA: one deterministic open signal for Community Signals inbox UI testing.
 * Idempotent by fixed primary key.
 *
 * Requires: POSTGRES_URL or DATABASE_URL
 *   node scripts/qa-community-signals-seed.js
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SIGNAL_ID = 'sig_qa_community_signals_seed_v1';
const RECIPIENT_USER_ID = 'usr_ff0e0495d46e1846';

async function main() {
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!pgUrl) {
    console.error('[qa-community-signals-seed] POSTGRES_URL or DATABASE_URL is required.');
    process.exit(1);
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  const bodyJson = JSON.stringify({
    seed: 'qa-community-signals-v1',
    message: 'Deterministic QA signal for Signals panel.',
  });

  await client.query(
    `INSERT INTO astradio_signals
      (id, recipient_user_id, anchor_type, anchor_id, template_id, body_json, status, reply_count, max_replies, expires_at, created_at)
     VALUES ($1, $2, 'connection', 'qa_anchor_connection_signals_v1', 'qa_community_signals_seed_v1', $3::jsonb, 'open', 0, 2, NOW() + INTERVAL '30 days', NOW())
     ON CONFLICT (id) DO UPDATE SET
       status = 'open',
       expires_at = EXCLUDED.expires_at,
       body_json = EXCLUDED.body_json,
       anchor_type = EXCLUDED.anchor_type,
       anchor_id = EXCLUDED.anchor_id,
       template_id = EXCLUDED.template_id,
       reply_count = 0,
       max_replies = EXCLUDED.max_replies`,
    [SIGNAL_ID, RECIPIENT_USER_ID, bodyJson]
  );

  await client.end();
  console.log('[qa-community-signals-seed] Upserted signal', SIGNAL_ID, 'for', RECIPIENT_USER_ID);
}

main().catch((err) => {
  console.error('[qa-community-signals-seed] Failed:', err);
  process.exit(1);
});
