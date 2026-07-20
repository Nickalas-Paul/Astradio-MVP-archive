/**
 * Deterministic loot roll for campaign encounters.
 * Same fingerprint + choice + stats => same result. No Math.random().
 */

import { sha256Hex } from './hash/json-hash';
import type {
  ItemDefinition,
  ItemRarity,
  LootRollInput,
  LootRollResult,
  LootTable,
} from './types';

const BASE_DROP_CHANCE = 0.6;
const RARITY_ORDER: ItemRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/** Map first 8 hex chars of a hash to [0, 1). */
function hashUnit(seed: string, salt: string): number {
  const hex = sha256Hex(`${seed}|${salt}`).slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
}

/** Map hash to integer in [0, maxExclusive). */
function hashInt(seed: string, salt: string, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.floor(hashUnit(seed, salt) * maxExclusive);
}

export function computeDropChance(playerCunning: number, boldChoice: boolean): number {
  let chance = BASE_DROP_CHANCE + (playerCunning - 10) * 0.02;
  if (boldChoice) chance += 0.1;
  return Math.min(0.95, Math.max(0.05, chance));
}

function rarityWeights(playerCunning: number): Record<ItemRarity, number> {
  const w: Record<ItemRarity, number> = {
    common: 50,
    uncommon: 30,
    rare: 15,
    legendary: 5,
  };
  if (playerCunning > 14) {
    w.common -= 5;
    w.uncommon += 5;
  }
  return w;
}

function pickRarity(seed: string, weights: Record<ItemRarity, number>): {
  rarity: ItemRarity;
  roll: number;
} {
  const roll = hashUnit(seed, 'rarity') * 100;
  let cumulative = 0;
  for (const rarity of RARITY_ORDER) {
    cumulative += weights[rarity];
    if (roll < cumulative) {
      return { rarity, roll };
    }
  }
  return { rarity: 'legendary', roll };
}

export function rollLoot(
  input: LootRollInput,
  tables: Map<number, LootTable>,
  definitions: Map<string, ItemDefinition>
): LootRollResult {
  const seed = `${input.challengeFingerprint}|${input.choiceId}`;
  const dropChance = computeDropChance(input.playerCunning, !!input.boldChoice);
  const dropRoll = hashUnit(seed, 'drop');

  const emptyTrace = {
    seed,
    dropChance,
    rarityRoll: 0,
    selectedRarity: null as ItemRarity | null,
    tableFiltered: 0,
  };

  if (dropRoll >= dropChance) {
    return { dropped: false, item: null, rollTrace: emptyTrace };
  }

  const table = tables.get(input.saturnHouse);
  if (!table) {
    return { dropped: false, item: null, rollTrace: { ...emptyTrace, tableFiltered: 0 } };
  }

  const eligible = table.items.filter((e) => e.minChapter <= input.campaignChapter);
  if (eligible.length === 0) {
    return {
      dropped: false,
      item: null,
      rollTrace: { ...emptyTrace, tableFiltered: 0 },
    };
  }

  const weights = rarityWeights(input.playerCunning);
  const { rarity, roll: rarityRoll } = pickRarity(seed, weights);

  let pool = eligible.filter((e) => {
    const def = definitions.get(e.slug);
    return def && def.rarity === rarity;
  });

  // Fall back to any eligible if rarity bucket empty
  if (pool.length === 0) {
    pool = eligible;
  }

  const idx = hashInt(seed, 'item', pool.length);
  const entry = pool[idx];
  const item = definitions.get(entry.slug) ?? null;

  return {
    dropped: !!item,
    item,
    rollTrace: {
      seed,
      dropChance,
      rarityRoll,
      selectedRarity: rarity,
      tableFiltered: eligible.length,
    },
  };
}

export function buildLootTableMap(tables: LootTable[]): Map<number, LootTable> {
  const m = new Map<number, LootTable>();
  for (const t of tables) m.set(t.saturnHouse, t);
  return m;
}

export function buildItemDefinitionMap(defs: ItemDefinition[]): Map<string, ItemDefinition> {
  const m = new Map<string, ItemDefinition>();
  for (const d of defs) m.set(d.slug, d);
  return m;
}
