/**
 * Pure inventory operations: add/remove/equip/unequip/use/stat bonuses.
 * No DB calls — operate on loaded InventoryState.
 */

import { sha256Hex } from './hash/json-hash';
import type {
  ConsumableEffect,
  EquipmentSlots,
  ItemDefinition,
  ItemInstance,
  InventoryState,
  SlotType,
  StatKey,
  UnlockedSlot,
} from './types';
import { createEmptyInventoryState } from './types';

export const MAX_CONSUMABLE_STACK = 5;

export interface RpgCampaignItemRow {
  id: string;
  campaign_id: string;
  item_slug: string;
  quantity: number;
  acquired_at: string;
  acquired_from: string;
  grant_seed: string | null;
  meta_json?: Record<string, unknown>;
}

export interface RpgCampaignEquipmentRow {
  campaign_id: string;
  weapon_item_id: string | null;
  armor_item_id: string | null;
  accessory_item_id: string | null;
  consumable_1_item_id: string | null;
  consumable_2_item_id: string | null;
  relic_item_id: string | null;
  slots_unlocked: string[];
  max_bag_size: number;
}

function cloneState(state: InventoryState): InventoryState {
  return {
    items: state.items.map((i) => ({ ...i })),
    equipped: { ...state.equipped },
    maxBagSize: state.maxBagSize,
    slotsUnlocked: [...state.slotsUnlocked],
  };
}

export function loadInventoryState(
  items: RpgCampaignItemRow[],
  equipment: RpgCampaignEquipmentRow | null
): InventoryState {
  if (!equipment) {
    const empty = createEmptyInventoryState();
    empty.items = items.map((row) => ({
      instanceId: row.id,
      slug: row.item_slug,
      acquiredAt: row.acquired_at,
      acquiredFrom: row.acquired_from,
      quantity: row.quantity,
    }));
    return empty;
  }

  const unlocked = (equipment.slots_unlocked || []) as UnlockedSlot[];
  return {
    items: items.map((row) => ({
      instanceId: row.id,
      slug: row.item_slug,
      acquiredAt: row.acquired_at,
      acquiredFrom: row.acquired_from,
      quantity: row.quantity,
    })),
    equipped: {
      weapon: equipment.weapon_item_id,
      armor: equipment.armor_item_id,
      accessory: equipment.accessory_item_id,
      relic: equipment.relic_item_id,
      consumable_1: equipment.consumable_1_item_id,
      consumable_2: equipment.consumable_2_item_id,
    },
    maxBagSize: equipment.max_bag_size ?? 15,
    slotsUnlocked: unlocked.length
      ? unlocked
      : (['weapon', 'armor', 'consumable'] as UnlockedSlot[]),
  };
}

export function getBagUtilization(state: InventoryState): { used: number; max: number } {
  return { used: state.items.length, max: state.maxBagSize };
}

export function canAddItem(state: InventoryState, definition?: ItemDefinition): boolean {
  if (definition?.category === 'consumable') {
    const existing = state.items.find(
      (i) => i.slug === definition.slug && i.quantity < MAX_CONSUMABLE_STACK
    );
    if (existing) return true;
  }
  return state.items.length < state.maxBagSize;
}

function makeInstanceId(grantSeed: string): string {
  return `itm_${sha256Hex(grantSeed).slice(0, 16)}`;
}

/**
 * Add an item from a loot grant. Consumables stack up to MAX_CONSUMABLE_STACK.
 * acquiredAt is derived from grantSeed for determinism (store may overwrite on insert).
 */
export function addItem(
  state: InventoryState,
  definition: ItemDefinition,
  source: string,
  grantSeed: string,
  acquiredAt?: string
): { state: InventoryState; instance: ItemInstance } {
  const next = cloneState(state);

  if (definition.category === 'consumable') {
    const stackable = next.items.find(
      (i) => i.slug === definition.slug && i.quantity < MAX_CONSUMABLE_STACK
    );
    if (stackable) {
      stackable.quantity += 1;
      return { state: next, instance: { ...stackable } };
    }
  }

  if (!canAddItem(state, definition)) {
    throw new Error('[inventory] Bag is full');
  }

  const instance: ItemInstance = {
    instanceId: makeInstanceId(grantSeed),
    slug: definition.slug,
    acquiredAt: acquiredAt ?? `seed:${grantSeed}`,
    acquiredFrom: source,
    quantity: 1,
  };
  next.items.push(instance);
  return { state: next, instance };
}

function clearEquippedRefs(equipped: EquipmentSlots, instanceId: string): EquipmentSlots {
  const next = { ...equipped };
  for (const key of Object.keys(next) as (keyof EquipmentSlots)[]) {
    if (next[key] === instanceId) next[key] = null;
  }
  return next;
}

export function removeItem(state: InventoryState, instanceId: string): InventoryState {
  const next = cloneState(state);
  next.items = next.items.filter((i) => i.instanceId !== instanceId);
  next.equipped = clearEquippedRefs(next.equipped, instanceId);
  return next;
}

function categoryUnlocked(state: InventoryState, category: SlotType): boolean {
  return state.slotsUnlocked.includes(category);
}

function consumable2Unlocked(state: InventoryState): boolean {
  return state.slotsUnlocked.includes('consumable_2');
}

function slotForCategory(
  state: InventoryState,
  category: ItemCategoryLike
): keyof EquipmentSlots | null {
  if (category === 'weapon') return 'weapon';
  if (category === 'armor') return 'armor';
  if (category === 'accessory') return 'accessory';
  if (category === 'relic') return 'relic';
  if (category === 'consumable') {
    if (!state.equipped.consumable_1) return 'consumable_1';
    if (consumable2Unlocked(state) && !state.equipped.consumable_2) return 'consumable_2';
    // Prefer replacing consumable_1 if both filled (caller still auto-unequips)
    if (!consumable2Unlocked(state)) return 'consumable_1';
    return 'consumable_1';
  }
  return null;
}

type ItemCategoryLike = ItemDefinition['category'];

export function equipItem(
  state: InventoryState,
  instanceId: string,
  definitions: Map<string, ItemDefinition>
): InventoryState {
  const item = state.items.find((i) => i.instanceId === instanceId);
  if (!item) {
    throw new Error(`[inventory] Item not found: ${instanceId}`);
  }
  const def = definitions.get(item.slug);
  if (!def) {
    throw new Error(`[inventory] Unknown item definition: ${item.slug}`);
  }
  if (!categoryUnlocked(state, def.category)) {
    throw new Error(`[inventory] Slot not unlocked for category: ${def.category}`);
  }

  const next = cloneState(state);
  const targetSlot = slotForCategory(next, def.category);
  if (!targetSlot) {
    throw new Error(`[inventory] No slot for category: ${def.category}`);
  }

  // Already equipped in any slot — no-op (keep in place)
  const already = (Object.keys(next.equipped) as (keyof EquipmentSlots)[]).find(
    (k) => next.equipped[k] === instanceId
  );
  if (already) return next;

  // Auto-unequip occupant (item remains in bag)
  next.equipped[targetSlot] = instanceId;
  return next;
}

export function unequipSlot(
  state: InventoryState,
  slot: keyof EquipmentSlots
): InventoryState {
  const next = cloneState(state);
  next.equipped[slot] = null;
  return next;
}

export function useConsumable(
  state: InventoryState,
  instanceId: string,
  definitions: Map<string, ItemDefinition>
): { state: InventoryState; effect: ConsumableEffect } {
  const item = state.items.find((i) => i.instanceId === instanceId);
  if (!item) {
    throw new Error(`[inventory] Item not found: ${instanceId}`);
  }
  const def = definitions.get(item.slug);
  if (!def || def.category !== 'consumable' || !def.consumableEffect) {
    throw new Error(`[inventory] Not a usable consumable: ${item.slug}`);
  }

  const next = cloneState(state);
  const idx = next.items.findIndex((i) => i.instanceId === instanceId);
  const target = next.items[idx];
  target.quantity -= 1;

  if (target.quantity <= 0) {
    next.items.splice(idx, 1);
    next.equipped = clearEquippedRefs(next.equipped, instanceId);
  }

  return { state: next, effect: { ...def.consumableEffect } };
}

function applyClassAffinity(
  mods: Partial<Record<StatKey, number>>,
  def: ItemDefinition,
  classSlug?: string
): Partial<Record<StatKey, number>> {
  if (!classSlug || !def.classAffinity || def.classAffinity !== classSlug) {
    return { ...mods };
  }
  const entries = Object.entries(mods) as [StatKey, number][];
  if (entries.length === 0) return { ...mods };
  let bestKey = entries[0][0];
  let bestVal = entries[0][1];
  for (const [k, v] of entries) {
    if (v > bestVal) {
      bestKey = k;
      bestVal = v;
    }
  }
  return { ...mods, [bestKey]: bestVal + 1 };
}

export function computeEquipmentStatBonuses(
  state: InventoryState,
  definitions: Map<string, ItemDefinition>,
  classSlug?: string
): Partial<Record<StatKey, number>> {
  const totals: Partial<Record<StatKey, number>> = {};
  const equippedIds = Object.values(state.equipped).filter(Boolean) as string[];

  for (const instanceId of equippedIds) {
    const inst = state.items.find((i) => i.instanceId === instanceId);
    if (!inst) continue;
    const def = definitions.get(inst.slug);
    if (!def || def.category === 'consumable') continue;
    const mods = applyClassAffinity(def.statModifiers || {}, def, classSlug);
    for (const [stat, val] of Object.entries(mods) as [StatKey, number][]) {
      totals[stat] = (totals[stat] ?? 0) + val;
    }
  }
  return totals;
}
