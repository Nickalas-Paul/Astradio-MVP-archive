/**
 * Orchestrates combat + narration + Phase 4 integration for campaign daily resolve.
 * DB grant/delete/equipment persistence returned as intents for the route to run on TX client.
 */

import { callGeminiGenerate } from '../render/gemini-client';
import { getCampaignChapter } from '../rpg/saturn-house';
import { addItem, computeEquipmentStatBonuses } from '../rpg/inventory-manager';
import { buildItemDefinitionMap } from '../rpg/loot-roller';
import { loadRpgV1Maps } from '../rpg/maps/load-v1';
import type {
  ActiveBuff,
  ActiveChapter,
  CampaignEra,
  CharacterHP,
  CharacterProfile,
  CombatResolution,
  ConsumableUseResult,
  DamageShield,
  EffectiveStatBlock,
  InventoryState,
  ItemInstance,
  MechanicalEncounter,
  MilestoneEvent,
  SaturnChapterState,
  UnlockedSlot,
} from '../rpg/types';
import type { EphemerisSnapshot } from '../contracts';
import { resolveCombat } from './combat-resolver';
import { applyDailyRecovery, ensureCharacterHp, updateStreak } from './hp-system';
import { buildNarrativePrompt } from './narrative-prompt-builder';
import { buildFallbackOutcome } from './narrative-fallback';
import { isGameCombatEnabled } from './feature-gate';
import { computeEffectiveStatBlock } from './effective-stats';
import { expireBuffs, expireShield } from './buff-manager';
import { processConsumableUse } from './consumable-use';
import {
  applyChapterTransitionRewards,
  applyEraShift,
  checkChapterTransition,
  checkEraShift,
  checkStreakMilestones,
  migrateSaturnChapterToMarsEra,
} from './milestone-tracker';

export { isGameCombatEnabled };

export interface CombatResolvePipelineInput {
  encounter: MechanicalEncounter;
  choiceId: string;
  characterProfile: CharacterProfile;
  inventoryState: InventoryState;
  hp: CharacterHP | null | undefined;
  streak: number;
  lastPlayedDate: string | null;
  flags: string[];
  history?: string[];
  activeChapter?: ActiveChapter | null;
  campaignEra?: CampaignEra | null;
  chapterTransitionCount?: number;
  /** @deprecated Prefer activeChapter; dual-read / migrate on resolve. */
  saturnChapter?: SaturnChapterState | null;
  activeBuffs?: ActiveBuff[];
  damageShield?: DamageShield | null;
  revealActive?: boolean;
  challengeFingerprint: string;
  calendarDate: string;
  campaignChapter: number;
  campaignId: string;
  classSlug?: string;
  recentHistory?: string[];
  skipGemini?: boolean;
  consumableUseInstanceId?: string;
  transitSnapshot?: EphemerisSnapshot;
  natalCusps?: number[];
}

export interface InventoryPersistIntent {
  grant?: { instance: ItemInstance; grantSeed: string };
  deleteInstanceId?: string;
  equipment?: {
    equipped: InventoryState['equipped'];
    slotsUnlocked: UnlockedSlot[];
    maxBagSize: number;
  };
  quantityUpdate?: { instanceId: string; quantity: number };
}

export interface CombatResolvePipelineResult {
  combatResolution: CombatResolution;
  hp: CharacterHP;
  streak: number;
  lastPlayedDate: string;
  flags: string[];
  history: string[];
  activeChapter: ActiveChapter | null;
  campaignEra: CampaignEra | null;
  chapterTransitionCount: number;
  /** Always null after migrate — kept so callers that still assign saturnChapter clear it. */
  saturnChapter: null;
  activeBuffs: ActiveBuff[];
  damageShield: DamageShield | null;
  revealActive: boolean;
  inventoryState: InventoryState;
  effectiveStats: EffectiveStatBlock;
  narration: { outcomeText: string; source: 'gemini' | 'fallback' };
  consumableUse: ConsumableUseResult | null;
  milestones: MilestoneEvent[];
  persistIntents: InventoryPersistIntent[];
  hpBefore: number;
}

export async function runCombatResolvePipeline(
  input: CombatResolvePipelineInput
): Promise<CombatResolvePipelineResult> {
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  let inventoryState = input.inventoryState;
  let activeBuffs = expireBuffs(input.activeBuffs, input.calendarDate);
  let damageShield = expireShield(input.damageShield, input.calendarDate);
  let revealActive = !!input.revealActive;
  const persistIntents: InventoryPersistIntent[] = [];
  const milestones: MilestoneEvent[] = [];

  let consumableUse: ConsumableUseResult | null = null;
  let hp = ensureCharacterHp(input.hp, input.characterProfile.statBlock);
  const hpBeforeDaily = hp.current;

  if (input.consumableUseInstanceId) {
    const cu = processConsumableUse({
      inventoryState,
      instanceId: input.consumableUseInstanceId,
      definitions,
      hp,
      calendarDate: input.calendarDate,
      activeBuffs,
      damageShield,
    });
    inventoryState = cu.inventoryState;
    hp = cu.hp;
    activeBuffs = cu.activeBuffs;
    damageShield = cu.damageShield;
    revealActive = cu.revealActive || revealActive;
    consumableUse = cu;

    if (cu.itemConsumed) {
      persistIntents.push({ deleteInstanceId: input.consumableUseInstanceId });
      persistIntents.push({
        equipment: {
          equipped: inventoryState.equipped,
          slotsUnlocked: inventoryState.slotsUnlocked,
          maxBagSize: inventoryState.maxBagSize,
        },
      });
    } else {
      const rem = inventoryState.items.find((i) => i.instanceId === input.consumableUseInstanceId);
      if (rem) {
        persistIntents.push({
          quantityUpdate: { instanceId: rem.instanceId, quantity: rem.quantity },
        });
      }
    }
  }

  const streakUpdate = updateStreak(input.streak || 0, input.lastPlayedDate, input.calendarDate);
  if (input.lastPlayedDate !== input.calendarDate) {
    hp = applyDailyRecovery(hp);
  }

  const equipmentBonuses = computeEquipmentStatBonuses(
    inventoryState,
    definitions,
    input.classSlug || input.characterProfile.classSlug
  );
  const effectiveStats = computeEffectiveStatBlock(
    input.characterProfile.statBlock,
    equipmentBonuses,
    activeBuffs,
    hp.wounded
  );

  const combat = resolveCombat({
    encounter: input.encounter,
    choiceId: input.choiceId,
    characterProfile: input.characterProfile,
    equipmentBonuses,
    effectiveStats,
    damageShield,
    hp,
    inventoryState,
    calendarDate: input.calendarDate,
    streak: streakUpdate.streak,
    flags: input.flags || [],
    challengeFingerprint: input.challengeFingerprint,
    campaignChapter: input.campaignChapter,
    definitions,
  });

  hp = combat.hp;
  let flags = combat.flags;
  let history = [...(input.history || [])];

  // Streak milestones
  const streakMs = checkStreakMilestones({
    streak: streakUpdate.streak,
    slotsUnlocked: inventoryState.slotsUnlocked,
    maxBagSize: inventoryState.maxBagSize,
    flags,
  });
  flags = streakMs.flags;
  inventoryState = {
    ...inventoryState,
    slotsUnlocked: streakMs.newSlots,
    maxBagSize: streakMs.maxBagSize,
  };
  milestones.push(...streakMs.events);
  if (streakMs.events.length > 0) {
    persistIntents.push({
      equipment: {
        equipped: inventoryState.equipped,
        slotsUnlocked: inventoryState.slotsUnlocked,
        maxBagSize: inventoryState.maxBagSize,
      },
    });
  }

  // Mars chapter + Saturn era (migrate legacy saturnChapter without granting rewards)
  let activeChapter: ActiveChapter | null = input.activeChapter ?? null;
  let campaignEra: CampaignEra | null = input.campaignEra ?? null;
  let chapterTransitionCount =
    typeof input.chapterTransitionCount === 'number' ? input.chapterTransitionCount : 0;

  if (input.transitSnapshot && input.natalCusps && input.natalCusps.length >= 12) {
    const migrated = migrateSaturnChapterToMarsEra({
      saturnChapter: input.saturnChapter,
      activeChapter,
      campaignEra,
      chapterTransitionCount,
      transitSnapshot: input.transitSnapshot,
      natalCusps: input.natalCusps,
      today: input.calendarDate,
    });
    activeChapter = migrated.activeChapter;
    campaignEra = migrated.campaignEra;
    chapterTransitionCount = migrated.chapterTransitionCount;

    const transition = checkChapterTransition(
      activeChapter,
      input.transitSnapshot,
      input.natalCusps,
      input.calendarDate
    );
    if (transition) {
      const rewards = applyChapterTransitionRewards({
        transition,
        chapterTransitionCountBefore: chapterTransitionCount,
        slotsUnlocked: inventoryState.slotsUnlocked,
        maxBagSize: inventoryState.maxBagSize,
        flags,
        history,
      });
      activeChapter = transition.updatedChapter;
      chapterTransitionCount = rewards.chapterTransitionCount;
      flags = rewards.flags;
      history = rewards.history;
      inventoryState = {
        ...inventoryState,
        slotsUnlocked: rewards.slotsUnlocked,
        maxBagSize: rewards.maxBagSize,
      };
      milestones.push(...rewards.events);
      persistIntents.push({
        equipment: {
          equipped: inventoryState.equipped,
          slotsUnlocked: inventoryState.slotsUnlocked,
          maxBagSize: inventoryState.maxBagSize,
        },
      });
      if (rewards.relic) {
        const grantSeed = `chapter_relic:${input.campaignId}:${transition.oldHouse}:${chapterTransitionCount}`;
        const added = addItem(
          inventoryState,
          rewards.relic,
          `chapter_complete_${transition.oldHouse}`,
          grantSeed
        );
        inventoryState = added.state;
        persistIntents.push({ grant: { instance: added.instance, grantSeed } });
      }
    }

    const eraShift = checkEraShift(
      campaignEra,
      input.transitSnapshot,
      input.natalCusps,
      input.calendarDate
    );
    if (eraShift) {
      campaignEra = eraShift.updatedEra;
      const eraFx = applyEraShift({ shift: eraShift, flags, history });
      flags = eraFx.flags;
      history = eraFx.history;
      milestones.push(...eraFx.events);
    }
  }

  // Loot grant
  if (combat.lootResult.dropped && combat.lootResult.item) {
    const grantSeed = `loot:${input.challengeFingerprint}:${input.choiceId}:${input.calendarDate}`;
    const added = addItem(
      inventoryState,
      combat.lootResult.item,
      `daily_${input.calendarDate}`,
      grantSeed
    );
    inventoryState = added.state;
    persistIntents.push({ grant: { instance: added.instance, grantSeed } });
  }

  // Crit fail item loss
  if (combat.itemLostInstanceId) {
    const lostId = combat.itemLostInstanceId;
    inventoryState = {
      ...inventoryState,
      items: inventoryState.items.filter((i) => i.instanceId !== lostId),
      equipped: Object.fromEntries(
        Object.entries(inventoryState.equipped).map(([k, v]) => [k, v === lostId ? null : v])
      ) as InventoryState['equipped'],
    };
    persistIntents.push({ deleteInstanceId: lostId });
    persistIntents.push({
      equipment: {
        equipped: inventoryState.equipped,
        slotsUnlocked: inventoryState.slotsUnlocked,
        maxBagSize: inventoryState.maxBagSize,
      },
    });
  }

  const choice = input.encounter.scene.choices.find((c) => c.id === input.choiceId)!;
  const chapterInfo = getCampaignChapter(
    activeChapter?.currentHouse ?? input.encounter.saturnHouse
  );

  let narrationText = '';
  let source: 'gemini' | 'fallback' = 'fallback';

  if (!input.skipGemini && process.env.GOOGLE_CLOUD_PROJECT) {
    try {
      const equippedNames = Object.values(inventoryState.equipped)
        .filter(Boolean)
        .map((id) => {
          const inst = inventoryState.items.find((i) => i.instanceId === id);
          if (!inst) return null;
          return definitions.get(inst.slug)?.name || inst.slug;
        })
        .filter(Boolean) as string[];

      const prompt = buildNarrativePrompt({
        characterClass: input.characterProfile.classSlug,
        characterSubclass: input.characterProfile.subclassSlug,
        characterRising: input.characterProfile.risingModifierSlug,
        statBlock: effectiveStats,
        hp: { ...hp, current: hpBeforeDaily },
        equippedItems: equippedNames,
        encounter: input.encounter,
        chosenOption: choice,
        combatResult: combat,
        activeChapter: {
          house: chapterInfo.house,
          domain: chapterInfo.domain,
          label: chapterInfo.thematicLabel,
        },
        campaignEra: campaignEra
          ? {
              house: campaignEra.currentHouse,
              domain: campaignEra.domain,
              label: campaignEra.label,
            }
          : null,
        campaignChapter: input.campaignChapter,
        recentHistory: input.recentHistory || history.slice(-3),
      });
      const result = await callGeminiGenerate({ prompt });
      narrationText = result.text;
      source = 'gemini';
    } catch (e) {
      console.warn('[combat-pipeline] Gemini narration failed, using fallback:', (e as Error)?.message);
      source = 'fallback';
    }
  }

  if (!narrationText) {
    narrationText = buildFallbackOutcome(input.encounter, choice, combat);
    source = 'fallback';
  }

  const { flags: _f, hp: _h, ...combatResolution } = combat;

  return {
    combatResolution,
    hp,
    streak: streakUpdate.streak,
    lastPlayedDate: streakUpdate.lastPlayedDate,
    flags,
    history,
    activeChapter,
    campaignEra,
    chapterTransitionCount,
    saturnChapter: null,
    activeBuffs,
    damageShield,
    revealActive,
    inventoryState,
    effectiveStats,
    narration: { outcomeText: narrationText, source },
    consumableUse,
    milestones,
    persistIntents,
    hpBefore: hpBeforeDaily,
  };
}
