-- Phase 2 — Game inventory: item instances + equipment slots per campaign.
-- FK targets stage5_campaigns(campaign_id).

CREATE TABLE IF NOT EXISTS rpg_campaign_items (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES stage5_campaigns(campaign_id) ON DELETE CASCADE,
  item_slug TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acquired_from TEXT NOT NULL,
  grant_seed TEXT UNIQUE,
  meta_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rpg_items_campaign ON rpg_campaign_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_rpg_items_slug ON rpg_campaign_items(item_slug);

CREATE TABLE IF NOT EXISTS rpg_campaign_equipment (
  campaign_id TEXT PRIMARY KEY REFERENCES stage5_campaigns(campaign_id) ON DELETE CASCADE,
  weapon_item_id TEXT REFERENCES rpg_campaign_items(id) ON DELETE SET NULL,
  armor_item_id TEXT REFERENCES rpg_campaign_items(id) ON DELETE SET NULL,
  accessory_item_id TEXT REFERENCES rpg_campaign_items(id) ON DELETE SET NULL,
  consumable_1_item_id TEXT REFERENCES rpg_campaign_items(id) ON DELETE SET NULL,
  consumable_2_item_id TEXT REFERENCES rpg_campaign_items(id) ON DELETE SET NULL,
  relic_item_id TEXT REFERENCES rpg_campaign_items(id) ON DELETE SET NULL,
  slots_unlocked TEXT[] NOT NULL DEFAULT ARRAY['weapon', 'armor', 'consumable'],
  max_bag_size INTEGER NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
