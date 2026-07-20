/**
 * Pure combat resolution: die roll, damage, loot, HP — no DB side effects.
 */

import { rollLoot, buildLootTableMap, buildItemDefinitionMap } from '../rpg/loot-roller';
import { loadRpgV1Maps } from '../rpg/maps/load-v1';
import type {
  CharacterHP,
  CharacterProfile,
  ChoiceOption,
  CombatResolution,
  DieRoll,
  InventoryState,
  ItemDefinition,
  LootRollResult,
  MechanicalEncounter,
  RollOutcome,
  StatKey,
} from '../rpg/types';
import { primaryStatForChoice, statModifier } from './choice-stat-map';
import { resilienceDamageReduction } from './damage-tables';
import {
  applyDamageToHp,
  applyHeal,
  applyWoundedStatPenalty,
} from './hp-system';
import { applyShieldToDamage } from './buff-manager';
import type { DamageShield, EffectiveStatBlock } from '../rpg/types';

export function hash32(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic d20: 1–20 inclusive. */
export function rollDie(seed: string): number {
  return (hash32(seed) % 20) + 1;
}

export function resolveRollOutcome(total: number, dc: number, wounded: boolean): RollOutcome {
  let outcome: RollOutcome;
  if (total >= dc + 10) outcome = 'critical_success';
  else if (total >= dc) outcome = 'success';
  else if (total >= dc - 4) outcome = 'partial';
  else if (total >= dc - 9) outcome = 'failure';
  else outcome = 'critical_failure';

  if (wounded && outcome === 'critical_success') {
    return 'success';
  }
  return outcome;
}

function emptyLoot(): LootRollResult {
  return {
    dropped: false,
    item: null,
    rollTrace: {
      seed: '',
      dropChance: 0,
      rarityRoll: 0,
      selectedRarity: null,
      tableFiltered: 0,
    },
  };
}

function itemValue(def: ItemDefinition): number {
  return Object.values(def.statModifiers || {}).reduce((a, b) => a + (b || 0), 0);
}

function findLowestValueEquippedInstance(
  inventory: InventoryState,
  definitions: Map<string, ItemDefinition>
): { instanceId: string; definition: ItemDefinition } | null {
  const ids = Object.values(inventory.equipped).filter(Boolean) as string[];
  let best: { instanceId: string; definition: ItemDefinition } | null = null;
  let bestVal = Infinity;
  for (const id of ids) {
    const inst = inventory.items.find((i) => i.instanceId === id);
    if (!inst) continue;
    const def = definitions.get(inst.slug);
    if (!def || def.category === 'consumable') continue;
    const v = itemValue(def);
    if (
      v < bestVal ||
      (v === bestVal && (!best || def.slug < best.definition.slug || id < best.instanceId))
    ) {
      best = { instanceId: id, definition: def };
      bestVal = v;
    }
  }
  return best;
}

export function resolveCombat(params: {
  encounter: MechanicalEncounter;
  choiceId: string;
  characterProfile: CharacterProfile;
  equipmentBonuses: Partial<Record<StatKey, number>>;
  hp: CharacterHP;
  inventoryState: InventoryState;
  calendarDate: string;
  streak: number;
  flags: string[];
  challengeFingerprint: string;
  campaignChapter?: number;
  definitions?: Map<string, ItemDefinition>;
  /** When provided, used instead of base+gear+wounded recomputation for primary stats. */
  effectiveStats?: EffectiveStatBlock;
  damageShield?: DamageShield | null;
  /** Optional override for tests */
  rawRollOverride?: number;
}): CombatResolution & { flags: string[]; hp: CharacterHP } {
  const {
    encounter,
    choiceId,
    characterProfile,
    equipmentBonuses,
    inventoryState,
    calendarDate,
    streak,
    challengeFingerprint,
  } = params;
  const campaignChapter = params.campaignChapter ?? 1;
  const eff = params.effectiveStats;

  const choice =
    encounter.scene.choices.find((c) => c.id === choiceId) ||
    ({ id: choiceId, outcomeDirection: 'assert_define', posture: 'assert' } as ChoiceOption);

  const primaryStat = encounter.choiceStatMap[choiceId] || primaryStatForChoice(choice);
  const effectiveStat = eff
    ? eff[primaryStat]
    : applyWoundedStatPenalty(
        (characterProfile.statBlock[primaryStat] ?? 10) + (equipmentBonuses[primaryStat] ?? 0),
        params.hp.wounded
      );
  const modifier = statModifier(effectiveStat);

  const seed = `${challengeFingerprint}:${choiceId}:${calendarDate}`;
  const raw = params.rawRollOverride ?? rollDie(seed);
  const total = raw + modifier;
  const dc = params.hp.wounded ? Math.max(1, encounter.dc - 2) : encounter.dc;
  const outcome = resolveRollOutcome(total, dc, params.hp.wounded);

  const dieRoll: DieRoll = { raw, modifier, total, outcome };

  const resilienceEff = eff
    ? eff.resilience
    : applyWoundedStatPenalty(characterProfile.statBlock.resilience ?? 10, params.hp.wounded);
  const armorFlat = Math.max(0, equipmentBonuses.resilience ?? 0);
  const reduction = resilienceDamageReduction(resilienceEff) + armorFlat;

  let rawDamage = 0;
  let healAmount = 0;
  if (outcome === 'critical_success') {
    rawDamage = 0;
    healAmount = 3;
  } else if (outcome === 'success') {
    rawDamage = 0;
  } else if (outcome === 'partial') {
    rawDamage = Math.max(1, Math.floor((encounter.baseDamage - reduction) / 2));
  } else if (outcome === 'failure') {
    rawDamage = Math.max(1, encounter.baseDamage - reduction);
  } else {
    rawDamage = Math.max(1, (encounter.baseDamage - reduction) * 2);
  }

  if (rawDamage > 0 && params.damageShield) {
    rawDamage = applyShieldToDamage(rawDamage, params.damageShield);
  }

  let hp = { ...params.hp };
  let flags = [...params.flags];
  let damageDealt = 0;
  let woundedTriggered = false;
  let streakSaved = false;

  if (healAmount > 0) {
    hp = applyHeal(hp, healAmount);
  }

  if (rawDamage > 0) {
    const applied = applyDamageToHp({
      hp,
      damage: rawDamage,
      resilience: resilienceEff,
      calendarDate,
      streak,
      flags,
    });
    hp = applied.hp;
    damageDealt = applied.damageDealt;
    woundedTriggered = applied.woundedTriggered;
    streakSaved = applied.streakSaved;
    flags = applied.flags;
  }

  const definitions =
    params.definitions ?? buildItemDefinitionMap(loadRpgV1Maps().itemDefinitions);
  const tables = buildLootTableMap(loadRpgV1Maps().lootTables);

  let lootResult = emptyLoot();
  const cunningEff = eff
    ? eff.cunning
    : applyWoundedStatPenalty(
        (characterProfile.statBlock.cunning ?? 10) + (equipmentBonuses.cunning ?? 0),
        params.hp.wounded
      );

  if (outcome === 'critical_success' || outcome === 'success' || outcome === 'partial') {
    let playerCunning = cunningEff;
    if (outcome === 'partial') playerCunning -= 10;
    if (outcome === 'critical_success') playerCunning += 10;
    const bold =
      typeof choice.outcomeDirection === 'string' && choice.outcomeDirection.includes('assert');

    lootResult = rollLoot(
      {
        saturnHouse: encounter.saturnHouse,
        challengeFingerprint,
        choiceId,
        playerCunning,
        campaignChapter,
        boldChoice: bold || outcome === 'critical_success',
      },
      tables,
      definitions
    );

    if (
      params.hp.wounded &&
      lootResult.dropped &&
      lootResult.item &&
      (lootResult.item.rarity === 'rare' || lootResult.item.rarity === 'legendary')
    ) {
      lootResult = {
        ...lootResult,
        dropped: false,
        item: null,
        rollTrace: { ...lootResult.rollTrace, selectedRarity: null },
      };
    }
  }

  let itemLost: ItemDefinition | null = null;
  let itemLostInstanceId: string | null = null;
  if (outcome === 'critical_failure') {
    const lost = findLowestValueEquippedInstance(inventoryState, definitions);
    if (lost) {
      itemLost = lost.definition;
      itemLostInstanceId = lost.instanceId;
    }
  }

  return {
    dieRoll,
    outcome,
    damageDealt,
    hpAfter: hp.current,
    healAmount,
    woundedTriggered,
    streakSaved,
    lootResult,
    itemLost,
    itemLostInstanceId,
    xpGained: 0,
    flags,
    hp,
  };
}

export { findLowestValueEquippedInstance };
