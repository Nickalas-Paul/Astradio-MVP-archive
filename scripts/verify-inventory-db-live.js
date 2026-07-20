#!/usr/bin/env node
/**
 * Live Phase 2 inventory DB verification against POSTGRES_URL.
 * Applies schema checks, grant_seed idempotency, and cascade delete.
 */
const { Pool } = require('pg');
const path = require('path');

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('POSTGRES_URL required');
  process.exit(1);
}

const needsSsl =
  process.env.PGSSLMODE === 'require' ||
  /render\.com|amazonaws\.com|rds\.amazonaws/i.test(POSTGRES_URL);

const pool = new Pool({
  connectionString: POSTGRES_URL,
  ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`✓ ${msg}`);
}

async function main() {
  const client = await pool.connect();
  const campaignId = `inv_test_${Date.now()}`;
  const grantSeed = `seed_idempotent_${campaignId}`;
  const itemId = `itm_test_${campaignId}`;

  try {
    // Schema present?
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('rpg_campaign_items', 'rpg_campaign_equipment', 'stage5_campaigns')
      ORDER BY table_name
    `);
    const names = tables.rows.map((r) => r.table_name);
    assert(names.includes('rpg_campaign_items'), 'rpg_campaign_items exists');
    assert(names.includes('rpg_campaign_equipment'), 'rpg_campaign_equipment exists');
    assert(names.includes('stage5_campaigns'), 'stage5_campaigns exists');

    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'rpg_campaign_items'
      ORDER BY ordinal_position
    `);
    const colNames = cols.rows.map((r) => r.column_name);
    assert(colNames.includes('grant_seed'), 'grant_seed column present');
    assert(colNames.includes('item_slug'), 'item_slug column present');

    const uniq = await client.query(`
      SELECT 1
      FROM pg_constraint
      WHERE conname LIKE '%grant_seed%'
         OR (
           contype = 'u'
           AND conrelid = 'rpg_campaign_items'::regclass
           AND pg_get_constraintdef(oid) ILIKE '%grant_seed%'
         )
      LIMIT 1
    `);
    assert(uniq.rows.length >= 1, 'UNIQUE constraint on grant_seed');

    // Temporary campaign for FK
    await client.query(
      `INSERT INTO stage5_campaigns (
         campaign_id, context_key, mode, owner_user_id,
         participant_user_ids, participant_chart_ids
       ) VALUES ($1, $2, 'solo', 'inv_test_user', ARRAY['inv_test_user'], ARRAY['inv_test_chart'])`,
      [campaignId, `inv_test_ctx_${campaignId}`]
    );
    assert(true, `created temp campaign ${campaignId}`);

    await client.query(
      `INSERT INTO rpg_campaign_equipment (campaign_id) VALUES ($1)`,
      [campaignId]
    );
    assert(true, 'initialized equipment row');

    // First grant
    await client.query(
      `INSERT INTO rpg_campaign_items (
         id, campaign_id, item_slug, quantity, acquired_from, grant_seed
       ) VALUES ($1, $2, 'mirror_blade', 1, 'daily_test', $3)`,
      [itemId, campaignId, grantSeed]
    );

    // Idempotent second grant (same grant_seed) — must not insert duplicate
    const second = await client.query(
      `INSERT INTO rpg_campaign_items (
         id, campaign_id, item_slug, quantity, acquired_from, grant_seed
       ) VALUES ($1, $2, 'mirror_blade', 1, 'daily_test', $3)
       ON CONFLICT (grant_seed) DO UPDATE SET updated_at = rpg_campaign_items.updated_at
       RETURNING id`,
      [`itm_dup_${campaignId}`, campaignId, grantSeed]
    );
    assert(second.rows[0].id === itemId, 'second grant returns original row (idempotent)');

    const count = await client.query(
      `SELECT COUNT(*)::int AS n FROM rpg_campaign_items WHERE campaign_id = $1`,
      [campaignId]
    );
    assert(count.rows[0].n === 1, `exactly 1 item after duplicate grant (got ${count.rows[0].n})`);

    // Equip reference then cascade delete campaign
    await client.query(
      `UPDATE rpg_campaign_equipment SET weapon_item_id = $2 WHERE campaign_id = $1`,
      [campaignId, itemId]
    );

    await client.query(`DELETE FROM stage5_campaigns WHERE campaign_id = $1`, [campaignId]);

    const leftoverItems = await client.query(
      `SELECT COUNT(*)::int AS n FROM rpg_campaign_items WHERE campaign_id = $1`,
      [campaignId]
    );
    const leftoverEq = await client.query(
      `SELECT COUNT(*)::int AS n FROM rpg_campaign_equipment WHERE campaign_id = $1`,
      [campaignId]
    );
    assert(leftoverItems.rows[0].n === 0, 'cascade deleted campaign items');
    assert(leftoverEq.rows[0].n === 0, 'cascade deleted campaign equipment');

    console.log('\n=== Live inventory DB verification passed ===\n');
  } finally {
    // Cleanup if anything left
    await client.query(`DELETE FROM stage5_campaigns WHERE campaign_id = $1`, [campaignId]).catch(() => {});
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error('Live inventory verify failed:', err);
  try {
    await pool.end();
  } catch (_) {}
  process.exit(1);
});
