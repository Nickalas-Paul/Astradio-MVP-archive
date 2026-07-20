/**
 * Postgres persistence for campaign items and equipment.
 * Optional PoolClient keeps inventory writes inside campaign resolve transactions.
 */

import type { EquipmentSlots, UnlockedSlot } from '../types';
import type { RpgCampaignEquipmentRow, RpgCampaignItemRow } from '../inventory-manager';
import type { ItemInstance } from '../types';

type PgQueryResult<T = unknown> = { rows: T[] };

type PgQueryable = {
  query: (text: string, params?: unknown[]) => Promise<PgQueryResult>;
};

type PgPoolLike = PgQueryable;

const POSTGRES_URL = process.env.POSTGRES_URL;

let pool: PgPoolLike | null = null;

function loadPg(): { Pool: new (cfg: object) => PgPoolLike } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('pg');
}

function getPool(): PgPoolLike {
  if (!POSTGRES_URL) {
    throw new Error('Inventory store requires POSTGRES_URL');
  }
  if (!pool) {
    const { Pool } = loadPg();
    const needsSsl =
      process.env.PGSSLMODE === 'require' ||
      process.env.NODE_ENV === 'production' ||
      /render\.com|amazonaws\.com|rds\.amazonaws/i.test(POSTGRES_URL || '');
    pool = new Pool({
      connectionString: POSTGRES_URL,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
  }
  return pool;
}

async function query<T = unknown>(
  text: string,
  params: unknown[] = [],
  client?: PgQueryable
): Promise<{ rows: T[] }> {
  const runner = client || getPool();
  return runner.query(text, params) as Promise<{ rows: T[] }>;
}

/** Grant an item idempotently via grant_seed UNIQUE. */
export async function grantItem(
  campaignId: string,
  item: ItemInstance,
  grantSeed: string,
  client?: PgQueryable
): Promise<RpgCampaignItemRow> {
  const { rows } = await query<RpgCampaignItemRow>(
    `INSERT INTO rpg_campaign_items (
       id, campaign_id, item_slug, quantity, acquired_at, acquired_from, grant_seed
     )
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6, $7)
     ON CONFLICT (grant_seed) DO UPDATE SET updated_at = rpg_campaign_items.updated_at
     RETURNING *`,
    [
      item.instanceId,
      campaignId,
      item.slug,
      item.quantity,
      item.acquiredAt.startsWith('seed:') ? null : item.acquiredAt,
      item.acquiredFrom,
      grantSeed,
    ],
    client
  );
  return rows[0];
}

export async function loadCampaignItems(
  campaignId: string,
  client?: PgQueryable
): Promise<RpgCampaignItemRow[]> {
  const { rows } = await query<RpgCampaignItemRow>(
    `SELECT * FROM rpg_campaign_items WHERE campaign_id = $1 ORDER BY acquired_at ASC`,
    [campaignId],
    client
  );
  return rows;
}

export async function loadEquipmentState(
  campaignId: string,
  client?: PgQueryable
): Promise<RpgCampaignEquipmentRow | null> {
  const { rows } = await query<RpgCampaignEquipmentRow>(
    `SELECT * FROM rpg_campaign_equipment WHERE campaign_id = $1`,
    [campaignId],
    client
  );
  return rows[0] ?? null;
}

export async function saveEquipmentState(
  campaignId: string,
  equipped: EquipmentSlots,
  slotsUnlocked: UnlockedSlot[],
  maxBagSize: number,
  client?: PgQueryable
): Promise<void> {
  await query(
    `INSERT INTO rpg_campaign_equipment (
       campaign_id, weapon_item_id, armor_item_id, accessory_item_id,
       consumable_1_item_id, consumable_2_item_id, relic_item_id,
       slots_unlocked, max_bag_size, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (campaign_id) DO UPDATE SET
       weapon_item_id = EXCLUDED.weapon_item_id,
       armor_item_id = EXCLUDED.armor_item_id,
       accessory_item_id = EXCLUDED.accessory_item_id,
       consumable_1_item_id = EXCLUDED.consumable_1_item_id,
       consumable_2_item_id = EXCLUDED.consumable_2_item_id,
       relic_item_id = EXCLUDED.relic_item_id,
       slots_unlocked = EXCLUDED.slots_unlocked,
       max_bag_size = EXCLUDED.max_bag_size,
       updated_at = NOW()`,
    [
      campaignId,
      equipped.weapon,
      equipped.armor,
      equipped.accessory,
      equipped.consumable_1,
      equipped.consumable_2,
      equipped.relic,
      slotsUnlocked,
      maxBagSize,
    ],
    client
  );
}

export async function deleteItem(instanceId: string, client?: PgQueryable): Promise<void> {
  await query(`DELETE FROM rpg_campaign_items WHERE id = $1`, [instanceId], client);
}

export async function initializeEquipment(
  campaignId: string,
  client?: PgQueryable
): Promise<void> {
  await query(
    `INSERT INTO rpg_campaign_equipment (campaign_id)
     VALUES ($1)
     ON CONFLICT (campaign_id) DO NOTHING`,
    [campaignId],
    client
  );
}

export async function updateItemQuantity(
  instanceId: string,
  quantity: number,
  client?: PgQueryable
): Promise<void> {
  if (quantity <= 0) {
    await deleteItem(instanceId, client);
    return;
  }
  await query(
    `UPDATE rpg_campaign_items SET quantity = $2, updated_at = NOW() WHERE id = $1`,
    [instanceId, quantity],
    client
  );
}
