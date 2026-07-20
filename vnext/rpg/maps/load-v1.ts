// vnext/rpg/maps/load-v1.ts
// Helper to load and validate v1 mapping tables for RPGEffectsBundle.
// Uses static JSON imports so assets are bundled (works in Next.js/Vercel server runtime).

import type { BodyId } from '../contracts';
import type { ItemDefinition, ItemRarity, LootTable } from '../types';

import bodyOrderData from './v1/BODY_ORDER.json';
import bodyBaseData from './v1/body_base.json';
import signStyleData from './v1/sign_style.json';
import houseArenaData from './v1/house_arena.json';
import houseStatAffinityData from './v1/house_stat_affinity.json';
import domainResolverNatalData from './v1/domain_resolver_natal.json';
import domainResolverTransitData from './v1/domain_resolver_transit.json';
import placementOverridesData from './v1/placement_overrides.json';
import turnTemplatesData from './v1/turn_templates.json';
import scenarioTemplatesData from './v1/scenario_templates.json';
import choiceTemplatesData from './v1/choice_templates.json';
import chapterLabelsData from './v1/chapter_labels.json';
import itemDefinitionsData from './v1/item_definitions.json';
import lootTablesData from './v1/loot_tables.json';

export interface ChapterLabelEntry {
  house: number;
  domain: string;
  lootTableKey: string;
  thematicLabel: string;
}

export interface RpgV1Maps {
  bodyOrder: BodyId[];
  bodyBase: any;
  signStyle: any;
  houseArena: Record<string, string>;
  houseStatAffinity: Record<string, { boosted_stat: string; multiplier: number }>;
  domainResolverNatal: any[];
  domainResolverTransit: any[];
  placementOverrides: any[];
  turnTemplates: any[];
  scenarioTemplates: any[];
  choiceTemplates: any[];
  chapterLabels: Record<string, ChapterLabelEntry>;
  itemDefinitions: ItemDefinition[];
  lootTables: LootTable[];
}

export function loadRpgV1Maps(): RpgV1Maps {
  const bodyOrder = bodyOrderData as string[];
  const bodyBase = bodyBaseData as Record<string, any>;
  const signStyle = signStyleData as Record<string, any>;
  const houseArena = houseArenaData as Record<string, string>;
  const houseStatAffinity = houseStatAffinityData as Record<
    string,
    { boosted_stat: string; multiplier: number }
  >;
  const domainResolverNatal = domainResolverNatalData as any[];
  const domainResolverTransit = domainResolverTransitData as any[];
  const placementOverrides = placementOverridesData as any[];
  const turnTemplates = turnTemplatesData as any[];
  const scenarioTemplates = scenarioTemplatesData as any[];
  const choiceTemplates = choiceTemplatesData as any[];

  if (!Array.isArray(bodyOrder) || bodyOrder.length === 0) {
    throw new Error('[rpg-maps] BODY_ORDER.json must be a non-empty array');
  }

  const requiredBodies: BodyId[] = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
    'ceres',
    'pallas',
    'juno',
    'vesta',
    'chiron',
  ];

  for (const b of requiredBodies) {
    if (!bodyOrder.includes(b)) {
      throw new Error(`[rpg-maps] BODY_ORDER.json missing required body: ${b}`);
    }
  }

  if (typeof bodyBase !== 'object' || bodyBase == null) {
    throw new Error('[rpg-maps] body_base.json must be an object');
  }

  if (typeof signStyle !== 'object' || signStyle == null) {
    throw new Error('[rpg-maps] sign_style.json must be an object');
  }

  if (typeof houseArena !== 'object' || houseArena == null) {
    throw new Error('[rpg-maps] house_arena.json must be an object');
  }

  if (typeof houseStatAffinity !== 'object' || houseStatAffinity == null) {
    throw new Error('[rpg-maps] house_stat_affinity.json must be an object');
  }
  for (let h = 1; h <= 12; h++) {
    const entry = houseStatAffinity[String(h)];
    if (!entry || typeof entry.boosted_stat !== 'string' || typeof entry.multiplier !== 'number') {
      throw new Error(`[rpg-maps] house_stat_affinity.json missing/invalid house ${h}`);
    }
  }

  const requiredStatBodies = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
  ];
  for (const b of requiredStatBodies) {
    const entry = bodyBase[b];
    if (!entry || typeof entry !== 'object') {
      throw new Error(`[rpg-maps] body_base.json missing body: ${b}`);
    }
    if (!entry.stat_primary || typeof entry.stat_primary !== 'object') {
      throw new Error(`[rpg-maps] body_base.json missing stat_primary for ${b}`);
    }
  }

  const requiredSigns = [
    'aries',
    'taurus',
    'gemini',
    'cancer',
    'leo',
    'virgo',
    'libra',
    'scorpio',
    'sagittarius',
    'capricorn',
    'aquarius',
    'pisces',
  ];
  for (const s of requiredSigns) {
    const entry = signStyle[s];
    if (!entry || typeof entry !== 'object') {
      throw new Error(`[rpg-maps] sign_style.json missing sign: ${s}`);
    }
    if (!entry.stat_bonus || typeof entry.stat_bonus !== 'object') {
      throw new Error(`[rpg-maps] sign_style.json missing stat_bonus for ${s}`);
    }
  }

  if (!Array.isArray(domainResolverNatal)) {
    throw new Error('[rpg-maps] domain_resolver_natal.json must be an array');
  }

  if (!Array.isArray(domainResolverTransit)) {
    throw new Error('[rpg-maps] domain_resolver_transit.json must be an array');
  }

  if (!Array.isArray(placementOverrides)) {
    throw new Error('[rpg-maps] placement_overrides.json must be an array');
  }

  if (!Array.isArray(turnTemplates) || turnTemplates.length === 0) {
    throw new Error('[rpg-maps] turn_templates.json must be a non-empty array');
  }

  if (!Array.isArray(scenarioTemplates) || scenarioTemplates.length === 0) {
    throw new Error('[rpg-maps] scenario_templates.json must be a non-empty array');
  }

  if (!Array.isArray(choiceTemplates) || choiceTemplates.length === 0) {
    throw new Error('[rpg-maps] choice_templates.json must be a non-empty array');
  }

  const chapterLabels = chapterLabelsData as Record<string, ChapterLabelEntry>;
  const itemDefinitions = itemDefinitionsData as ItemDefinition[];
  const lootTables = lootTablesData as LootTable[];

  if (typeof chapterLabels !== 'object' || chapterLabels == null) {
    throw new Error('[rpg-maps] chapter_labels.json must be an object');
  }
  for (let h = 1; h <= 12; h++) {
    const entry = chapterLabels[String(h)];
    if (
      !entry ||
      entry.house !== h ||
      typeof entry.domain !== 'string' ||
      typeof entry.lootTableKey !== 'string' ||
      typeof entry.thematicLabel !== 'string'
    ) {
      throw new Error(`[rpg-maps] chapter_labels.json missing/invalid house ${h}`);
    }
  }

  if (!Array.isArray(itemDefinitions) || itemDefinitions.length === 0) {
    throw new Error('[rpg-maps] item_definitions.json must be a non-empty array');
  }

  const rarityMax: Record<ItemRarity, number> = {
    common: 1,
    uncommon: 2,
    rare: 3,
    legendary: 4,
  };
  const validCategories = new Set(['weapon', 'armor', 'accessory', 'consumable', 'relic']);
  const validRarities = new Set(['common', 'uncommon', 'rare', 'legendary']);
  const slugSet = new Set<string>();

  for (const def of itemDefinitions) {
    if (!def.slug || slugSet.has(def.slug)) {
      throw new Error(`[rpg-maps] item_definitions duplicate/missing slug: ${def?.slug}`);
    }
    slugSet.add(def.slug);
    if (!validCategories.has(def.category)) {
      throw new Error(`[rpg-maps] invalid category for ${def.slug}`);
    }
    if (!validRarities.has(def.rarity)) {
      throw new Error(`[rpg-maps] invalid rarity for ${def.slug}`);
    }
    if (def.saturnHouse < 1 || def.saturnHouse > 12) {
      throw new Error(`[rpg-maps] invalid saturnHouse for ${def.slug}`);
    }
    const maxMod = rarityMax[def.rarity];
    for (const v of Object.values(def.statModifiers || {})) {
      if (typeof v !== 'number' || v < 1 || v > maxMod) {
        throw new Error(`[rpg-maps] stat modifier out of rarity bounds for ${def.slug}`);
      }
    }
    if (def.category === 'consumable' && !def.consumableEffect) {
      throw new Error(`[rpg-maps] consumable missing effect: ${def.slug}`);
    }
  }

  if (!Array.isArray(lootTables) || lootTables.length !== 12) {
    throw new Error('[rpg-maps] loot_tables.json must have exactly 12 tables');
  }

  for (const table of lootTables) {
    if (table.saturnHouse < 1 || table.saturnHouse > 12) {
      throw new Error(`[rpg-maps] invalid loot table house ${table.saturnHouse}`);
    }
    if (!Array.isArray(table.items) || table.items.length < 4) {
      throw new Error(`[rpg-maps] loot table house ${table.saturnHouse} needs >= 4 items`);
    }
    for (const entry of table.items) {
      if (!slugSet.has(entry.slug)) {
        throw new Error(
          `[rpg-maps] loot table house ${table.saturnHouse} references unknown slug ${entry.slug}`
        );
      }
    }
  }

  for (const fullHouse of [1, 7, 10]) {
    const table = lootTables.find((t) => t.saturnHouse === fullHouse);
    if (!table || table.items.length < 12 || table.items.length > 16) {
      throw new Error(
        `[rpg-maps] full loot table house ${fullHouse} must have 12-16 items (got ${table?.items.length})`
      );
    }
  }

  return {
    bodyOrder: bodyOrder as BodyId[],
    bodyBase,
    signStyle,
    houseArena,
    houseStatAffinity,
    domainResolverNatal,
    domainResolverTransit,
    placementOverrides,
    turnTemplates,
    scenarioTemplates,
    choiceTemplates,
    chapterLabels,
    itemDefinitions,
    lootTables,
  };
}

