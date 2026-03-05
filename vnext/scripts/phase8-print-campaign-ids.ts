#!/usr/bin/env node
/**
 * Phase 8 — helper script to print campaign env IDs.
 *
 * Reads POSTGRES_URL (or DATABASE_URL fallback), connects to Postgres,
 * and prints either:
 *   NO_CAMPAIGNS_FOUND
 * or, when a row exists:
 *   RPG_BETA_CAMPAIGN_ID=<id>
 *   RPG_BETA_USER_ID=<user_id>
 *
 * No schema changes, no row creation.
 */

import 'dotenv/config';
import { Pool } from 'pg';

async function main(): Promise<void> {
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!conn) {
    // Do not print credentials; just signal missing configuration.
    // eslint-disable-next-line no-console
    console.error('POSTGRES_URL (or DATABASE_URL) is not set; cannot query rpg_campaigns.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: conn });

  try {
    const res = await pool.query(
      `
      SELECT id, user_id, created_at
      FROM rpg_campaigns
      ORDER BY created_at DESC
      LIMIT 1
      `
    );

    const row = res.rows[0] as { id: string; user_id: string; created_at: string } | undefined;
    if (!row) {
      // eslint-disable-next-line no-console
      console.log('NO_CAMPAIGNS_FOUND');
      return;
    }

    // Exact lines expected for env wiring.
    // eslint-disable-next-line no-console
    console.log(`RPG_BETA_CAMPAIGN_ID=${row.id}`);
    // eslint-disable-next-line no-console
    console.log(`RPG_BETA_USER_ID=${row.user_id}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

