/**
 * Phase 5 — Game API response DTO builders (pure, testable).
 */

import type {
  ActiveBuff,
  CharacterHP,
  CharacterProfile,
  CharacterResponseDTO,
  EncounterResponseDTO,
  EquipmentSlots,
  EquippedItemSummaryDTO,
  GameStateResponseDTO,
  InventoryResponseDTO,
  InventoryState,
  ItemDefinition,
  LootTable,
  LootTableResponseDTO,
  MechanicalEncounter,
  CampaignState,
  StatBlock,
  StatDerivationTrace,
  StatKey,
} from '../rpg/types';
import type { RPGEffectsBundle } from '../rpg/contracts';
import { computeEquipmentStatBonuses, getBagUtilization } from '../rpg/inventory-manager';
import { getCampaignChapter } from '../rpg/saturn-house';
import { computeEffectiveStatBlock } from './effective-stats';
import { expireBuffs } from './buff-manager';
import { ensureCharacterHp, createFullHp } from './hp-system';
import { primaryStatForChoice, statModifier } from './choice-stat-map';
import { buildRevealHint } from './reveal-hint';
import { findHouseRelic } from './milestone-tracker';

export function slugToDisplayName(slug: string): string {
  const raw = String(slug || '')
    .replace(/^(class_|subclass_|rising_)/, '')
    .replace(/_/g, ' ')
    .trim();
  if (!raw) return slug;
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function equippedSlotForInstance(
  equipped: EquipmentSlots,
  instanceId: string
): keyof EquipmentSlots | null {
  const keys = Object.keys(equipped) as (keyof EquipmentSlots)[];
  for (const k of keys) {
    if (equipped[k] === instanceId) return k;
  }
  return null;
}

function summarizeEquipped(
  instanceId: string | null,
  items: InventoryState['items'],
  definitions: Map<string, ItemDefinition>
): EquippedItemSummaryDTO | null {
  if (!instanceId) return null;
  const inst = items.find((i) => i.instanceId === instanceId);
  if (!inst) return null;
  const def = definitions.get(inst.slug);
  return {
    instanceId,
    slug: inst.slug,
    name: def?.name || inst.slug,
    category: def?.category || 'unknown',
    rarity: def?.rarity || 'common',
    statModifiers: def?.statModifiers || {},
  };
}

export function buildInventoryDTO(
  campaignId: string,
  inventoryState: InventoryState,
  definitions: Map<string, ItemDefinition>,
  classSlug?: string
): InventoryResponseDTO {
  const bag = inventoryState.items.map((inst) => {
    const def = definitions.get(inst.slug);
    const slot = equippedSlotForInstance(inventoryState.equipped, inst.instanceId);
    return {
      instanceId: inst.instanceId,
      slug: inst.slug,
      name: def?.name || inst.slug,
      description: def?.description || '',
      category: def?.category || 'unknown',
      rarity: def?.rarity || 'common',
      statModifiers: def?.statModifiers || {},
      quantity: inst.quantity,
      acquiredAt: inst.acquiredAt,
      acquiredFrom: inst.acquiredFrom,
      consumableEffect: def?.consumableEffect ?? null,
      equipped: !!slot,
      equippedSlot: slot,
    };
  });

  const eq = inventoryState.equipped;
  const equipped = {
    weapon: summarizeEquipped(eq.weapon, inventoryState.items, definitions),
    armor: summarizeEquipped(eq.armor, inventoryState.items, definitions),
    accessory: summarizeEquipped(eq.accessory, inventoryState.items, definitions),
    consumable_1: summarizeEquipped(eq.consumable_1, inventoryState.items, definitions),
    consumable_2: summarizeEquipped(eq.consumable_2, inventoryState.items, definitions),
    relic: summarizeEquipped(eq.relic, inventoryState.items, definitions),
  };

  const util = getBagUtilization(inventoryState);
  return {
    campaignId,
    bag,
    equipped,
    slotsUnlocked: [...inventoryState.slotsUnlocked],
    maxBagSize: inventoryState.maxBagSize,
    bagUsed: util.used,
    statBonusesFromGear: computeEquipmentStatBonuses(inventoryState, definitions, classSlug),
  };
}

export function buildCharacterDTO(params: {
  profile: CharacterProfile;
  inventoryState: InventoryState;
  definitions: Map<string, ItemDefinition>;
  campaignState: Pick<CampaignState, 'activeBuffs' | 'hp'> | null | undefined;
  calendarDate?: string;
}): CharacterResponseDTO {
  const { profile, inventoryState, definitions } = params;
  const today = params.calendarDate || new Date().toISOString().slice(0, 10);
  const activeBuffs = expireBuffs(params.campaignState?.activeBuffs, today);
  const hp = ensureCharacterHp(params.campaignState?.hp, profile.statBlock);
  const gear = computeEquipmentStatBonuses(inventoryState, definitions, profile.classSlug);
  const effectiveStats = computeEffectiveStatBlock(profile.statBlock, gear, activeBuffs, hp.wounded);

  const equippedItems: CharacterResponseDTO['equippedItems'] = [];
  for (const [slot, id] of Object.entries(inventoryState.equipped) as [string, string | null][]) {
    if (!id) continue;
    const inst = inventoryState.items.find((i) => i.instanceId === id);
    if (!inst) continue;
    const def = definitions.get(inst.slug);
    equippedItems.push({
      slot,
      instanceId: id,
      slug: inst.slug,
      name: def?.name || inst.slug,
      category: def?.category || 'unknown',
      rarity: def?.rarity || 'common',
      statModifiers: def?.statModifiers || {},
    });
  }

  return {
    characterId: profile.id,
    classSlug: profile.classSlug,
    className: slugToDisplayName(profile.classSlug),
    subclassSlug: profile.subclassSlug,
    subclassName: slugToDisplayName(profile.subclassSlug),
    risingSlug: profile.risingModifierSlug,
    risingName: slugToDisplayName(profile.risingModifierSlug),
    primaryElement: profile.primaryElement,
    dominantPlanets: [...profile.dominantPlanets],
    baseStats: { ...profile.statBlock },
    effectiveStats,
    equippedItems,
    activeBuffs,
    temperament: { ...profile.temperament },
    statTrace: profile.statTrace,
  };
}

/** Build a minimal CharacterProfile from bundle stats when full profile build is unavailable. */
export function profileFromBundle(
  bundle: RPGEffectsBundle,
  statBlock: StatBlock,
  statTrace: StatDerivationTrace
): CharacterProfile {
  return {
    id: `char_${(bundle.metadata?.natal_snapshot_hash || 'bundle').toString().slice(0, 16)}`,
    classSlug: bundle.classSlug,
    subclassSlug: bundle.subclassSlug,
    risingModifierSlug: bundle.risingModifierSlug,
    primaryElement: 'earth',
    tonalPolarity: 'balanced',
    motionProfile: 'steady',
    gravityProfile: 'medium',
    luminaryWeight: 'balanced',
    dominantPlanets: [],
    angularEmphasis: { first: false, fourth: false, seventh: false, tenth: false },
    temperament: {
      will: 0.5,
      insight: 0.5,
      attunement: 0.5,
      courage: 0.5,
      discipline: 0.5,
      adaptability: 0.5,
      bond: 0.5,
      shadowCapacity: 0.4,
      radiance: 0.5,
    },
    signatureDomains: [],
    statBlock,
    statTrace,
  };
}

export function buildGameStateDTO(params: {
  campaignId: string;
  state: CampaignState | Record<string, unknown> | null | undefined;
  inventoryState: InventoryState;
  fallbackStats?: Pick<StatBlock, 'vitality' | 'resilience'>;
}): GameStateResponseDTO {
  const state = (params.state || {}) as CampaignState;
  const stats = params.fallbackStats || { vitality: 10, resilience: 10 };
  const hp: CharacterHP = state.hp ? { ...state.hp } : createFullHp(stats);
  const flags = Array.isArray(state.flags) ? state.flags : [];
  const milestoneFlags = flags.filter(
    (f) =>
      typeof f === 'string' &&
      (f.startsWith('milestone_') ||
        f.startsWith('saturn_transition_') ||
        f.startsWith('chapter_transition_') ||
        f.startsWith('era_shift_'))
  );
  const equippedCount = Object.values(params.inventoryState.equipped).filter(Boolean).length;
  const activeChapter = state.activeChapter ?? null;
  const saturnChapter = state.saturnChapter ?? null;
  // Dual-read: prefer Mars chapter; fall back to legacy Saturn for unmigrated campaigns.
  const resolvedChapter = activeChapter ?? (saturnChapter
    ? {
        startingHouse: saturnChapter.startingHouse,
        currentHouse: saturnChapter.currentHouse,
        domain: saturnChapter.domain,
        label: saturnChapter.label,
        enteredDate: saturnChapter.enteredDate,
        transitBody: 'mars' as const,
      }
    : null);

  return {
    campaignId: params.campaignId,
    hp,
    streak: typeof state.streak === 'number' ? state.streak : 0,
    lastPlayedDate: state.lastPlayedDate ?? null,
    chapter: Number.isFinite(state.chapter) ? Number(state.chapter) : 1,
    activeChapter: resolvedChapter,
    campaignEra: state.campaignEra ?? null,
    chapterTransitionCount:
      typeof state.chapterTransitionCount === 'number'
        ? state.chapterTransitionCount
        : saturnChapter?.transitionCount ?? 0,
    // Dual-read for older clients; prefer activeChapter.
    saturnChapter,
    damageShield: state.damageShield ?? null,
    revealActive: !!state.revealActive,
    slotsUnlocked: [...params.inventoryState.slotsUnlocked],
    maxBagSize: params.inventoryState.maxBagSize,
    inventorySummary: {
      itemCount: params.inventoryState.items.length,
      bagCapacity: params.inventoryState.maxBagSize,
      equippedCount,
    },
    milestoneFlags,
  };
}

export function buildEncounterDTO(params: {
  campaignId: string;
  calendarDate: string;
  dailyInner: Record<string, unknown>;
  resolution: unknown | null;
  profile: CharacterProfile;
  inventoryState: InventoryState;
  definitions: Map<string, ItemDefinition>;
  campaignState: CampaignState | Record<string, unknown> | null | undefined;
}): EncounterResponseDTO {
  const daily = params.dailyInner;
  const challenge = (daily.challenge || {}) as {
    theme?: string;
    setting?: string;
    obstacle?: string | { name?: string; brief?: string };
    choices?: Array<{
      id: string;
      label: string;
      symbolicGesture: string;
      riskProfile: string;
      outcomeDirection?: string;
      posture?: string;
    }>;
  };
  const mech = (daily.mechanical_encounter || null) as MechanicalEncounter | null;
  const state = (params.campaignState || {}) as CampaignState;
  const today = params.calendarDate;
  const activeBuffs = expireBuffs(state.activeBuffs, today);
  const hp = ensureCharacterHp(state.hp, params.profile.statBlock);
  const gear = computeEquipmentStatBonuses(
    params.inventoryState,
    params.definitions,
    params.profile.classSlug
  );
  const effectiveStats = computeEffectiveStatBlock(
    params.profile.statBlock,
    gear,
    activeBuffs,
    hp.wounded
  );

  const choices = (challenge.choices || []).map((c) => {
    const primary = primaryStatForChoice(c as import('../rpg/types').ChoiceOption);
    const val = effectiveStats[primary as StatKey] ?? 10;
    return {
      id: c.id,
      label: c.label,
      symbolicGesture: c.symbolicGesture,
      riskProfile: c.riskProfile,
      primaryStat: primary,
      currentModifier: statModifier(val),
    };
  });

  const equippedSummary = Object.values(params.inventoryState.equipped)
    .filter(Boolean)
    .map((id) => {
      const inst = params.inventoryState.items.find((i) => i.instanceId === id);
      if (!inst) return null;
      return params.definitions.get(inst.slug)?.name || inst.slug;
    })
    .filter(Boolean) as string[];

  const fingerprint = String(daily.challenge_fingerprint || '');
  const revealHint = buildRevealHint({
    challengeFingerprint: fingerprint,
    calendarDate: today,
    revealActive: !!state.revealActive,
  });
  const obstacle =
    typeof challenge.obstacle === 'string'
      ? challenge.obstacle
      : challenge.obstacle?.name
        ? `${challenge.obstacle.name}: ${challenge.obstacle.brief || ''}`.trim()
        : '';

  return {
    campaignId: params.campaignId,
    calendarDate: today,
    encounter: {
      theme: challenge.theme || '',
      setting: challenge.setting || '',
      obstacle,
      dc: mech?.dc ?? 10,
      baseDamage: mech?.baseDamage ?? 0,
      saturnHouse:
        mech?.saturnHouse ??
        state.activeChapter?.currentHouse ??
        state.saturnChapter?.currentHouse ??
        1,
      lootTableKey:
        mech?.lootTableKey ||
        `saturn_house_${
          mech?.saturnHouse ??
          state.activeChapter?.currentHouse ??
          state.saturnChapter?.currentHouse ??
          1
        }`,
      introNarration: String(daily.encounter_intro_narration || ''),
      introSource: (daily.encounter_intro_source as 'gemini' | 'fallback') || 'fallback',
    },
    choices,
    playerState: {
      hp,
      effectiveStats,
      equippedSummary,
      wounded: hp.wounded,
      streak: typeof state.streak === 'number' ? state.streak : 0,
      revealHint,
    },
    resolved: !!params.resolution,
    resolution: params.resolution,
  };
}

export function buildLootTableDTO(params: {
  campaignId: string;
  saturnHouse: number;
  table: LootTable | null | undefined;
  definitions: Map<string, ItemDefinition>;
  classSlug: string;
  campaignChapter: number;
}): LootTableResponseDTO {
  const info = getCampaignChapter(params.saturnHouse);
  const entries = (params.table?.items || []).filter(
    (e) => e.minChapter <= params.campaignChapter
  );
  const items = entries
    .map((e) => {
      const def = params.definitions.get(e.slug);
      if (!def) return null;
      return {
        slug: def.slug,
        name: def.name,
        description: def.description,
        category: def.category,
        rarity: def.rarity,
        statModifiers: def.statModifiers || {},
        elementAffinity: def.elementAffinity ?? null,
        classAffinityBonus: !!(def.classAffinity && def.classAffinity === params.classSlug),
        dropWeight: def.rarity,
      };
    })
    .filter(Boolean) as LootTableResponseDTO['items'];

  items.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.rarity !== b.rarity) return a.rarity.localeCompare(b.rarity);
    return a.slug.localeCompare(b.slug);
  });

  const relic = findHouseRelic(params.saturnHouse);
  return {
    campaignId: params.campaignId,
    saturnHouse: params.saturnHouse,
    domain: info.domain,
    label: info.thematicLabel,
    items,
    relicReward: relic
      ? {
          slug: relic.slug,
          name: relic.name,
          description: relic.description,
          statModifiers: relic.statModifiers || {},
        }
      : null,
  };
}
