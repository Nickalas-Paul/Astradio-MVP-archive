/**
 * Streak milestones + Mars chapter transition / Saturn era detection & rewards.
 */

import type { EphemerisSnapshot } from '../contracts';
import {
  getMarsTransitHouse,
  getSaturnTransitHouse,
  getCampaignChapter,
} from '../rpg/saturn-house';
import { loadRpgV1Maps } from '../rpg/maps/load-v1';
import type {
  ActiveChapter,
  CampaignEra,
  ItemDefinition,
  MilestoneEvent,
  SaturnChapterState,
  UnlockedSlot,
} from '../rpg/types';

export const MAX_BAG_SIZE_CAP = 50;

/** @deprecated Prefer buildActiveChapter — kept for migration/tests. */
export function buildSaturnChapterState(
  house: number,
  enteredDate: string,
  transitionCount = 0,
  startingHouse?: number
): SaturnChapterState {
  const info = getCampaignChapter(house);
  return {
    startingHouse: startingHouse ?? house,
    currentHouse: house,
    domain: info.domain,
    label: info.thematicLabel,
    enteredDate,
    transitionCount,
  };
}

export function buildActiveChapter(
  house: number,
  enteredDate: string,
  startingHouse?: number
): ActiveChapter {
  const info = getCampaignChapter(house);
  return {
    startingHouse: startingHouse ?? house,
    currentHouse: house,
    domain: info.domain,
    label: info.thematicLabel,
    enteredDate,
    transitBody: 'mars',
  };
}

export function buildCampaignEra(house: number, enteredDate: string): CampaignEra {
  const info = getCampaignChapter(house);
  return {
    currentHouse: house,
    domain: info.domain,
    label: info.thematicLabel,
    enteredDate,
    transitBody: 'saturn',
  };
}

/**
 * Migrate legacy saturnChapter → activeChapter (Mars) + campaignEra (Saturn).
 * Does NOT grant transition rewards. Seeds activeChapter from current Mars house.
 */
export function migrateSaturnChapterToMarsEra(params: {
  saturnChapter: SaturnChapterState | null | undefined;
  activeChapter: ActiveChapter | null | undefined;
  campaignEra: CampaignEra | null | undefined;
  chapterTransitionCount: number | undefined;
  transitSnapshot: EphemerisSnapshot;
  natalCusps: number[];
  today: string;
}): {
  activeChapter: ActiveChapter;
  campaignEra: CampaignEra;
  chapterTransitionCount: number;
  migrated: boolean;
} {
  const { transitSnapshot, natalCusps, today } = params;
  let migrated = false;
  let activeChapter = params.activeChapter ?? null;
  let campaignEra = params.campaignEra ?? null;
  let chapterTransitionCount =
    typeof params.chapterTransitionCount === 'number' ? params.chapterTransitionCount : 0;

  if (!activeChapter || !Number.isFinite(activeChapter.currentHouse)) {
    const marsHouse = getMarsTransitHouse(transitSnapshot, natalCusps);
    activeChapter = buildActiveChapter(marsHouse, today);
    migrated = true;
  }

  if (!campaignEra || !Number.isFinite(campaignEra.currentHouse)) {
    if (params.saturnChapter && Number.isFinite(params.saturnChapter.currentHouse)) {
      campaignEra = {
        currentHouse: params.saturnChapter.currentHouse,
        domain: params.saturnChapter.domain,
        label: params.saturnChapter.label,
        enteredDate: params.saturnChapter.enteredDate || today,
        transitBody: 'saturn',
      };
      if (typeof params.saturnChapter.transitionCount === 'number' && !params.chapterTransitionCount) {
        chapterTransitionCount = params.saturnChapter.transitionCount;
      }
    } else {
      const saturnHouse = getSaturnTransitHouse(transitSnapshot, natalCusps);
      campaignEra = buildCampaignEra(saturnHouse, today);
    }
    migrated = true;
  }

  return { activeChapter, campaignEra, chapterTransitionCount, migrated };
}

/** Ensure activeChapter exists (seed from Mars; no reward). */
export function ensureActiveChapter(
  existing: ActiveChapter | null | undefined,
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[],
  today: string
): { chapter: ActiveChapter; backfilled: boolean } {
  if (existing && Number.isFinite(existing.currentHouse)) {
    return { chapter: existing, backfilled: false };
  }
  const house = getMarsTransitHouse(transitSnapshot, natalCusps);
  return { chapter: buildActiveChapter(house, today), backfilled: true };
}

/** Ensure campaignEra exists (seed from Saturn; no reward). */
export function ensureCampaignEra(
  existing: CampaignEra | null | undefined,
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[],
  today: string
): { era: CampaignEra; backfilled: boolean } {
  if (existing && Number.isFinite(existing.currentHouse)) {
    return { era: existing, backfilled: false };
  }
  const house = getSaturnTransitHouse(transitSnapshot, natalCusps);
  return { era: buildCampaignEra(house, today), backfilled: true };
}

/**
 * Mars house change vs stored activeChapter.
 * Returns null if activeChapter missing (caller must seed first — never treat seed as transition).
 */
export function checkChapterTransition(
  chapter: ActiveChapter | null | undefined,
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[],
  today: string
): {
  transitioned: true;
  newHouse: number;
  oldHouse: number;
  newDomain: string;
  newLabel: string;
  updatedChapter: ActiveChapter;
} | null {
  if (!chapter || !Number.isFinite(chapter.currentHouse)) return null;
  const newHouse = getMarsTransitHouse(transitSnapshot, natalCusps);
  if (newHouse === chapter.currentHouse) return null;
  const info = getCampaignChapter(newHouse);
  return {
    transitioned: true,
    newHouse,
    oldHouse: chapter.currentHouse,
    newDomain: info.domain,
    newLabel: info.thematicLabel,
    updatedChapter: {
      startingHouse: chapter.startingHouse,
      currentHouse: newHouse,
      domain: info.domain,
      label: info.thematicLabel,
      enteredDate: today,
      transitBody: 'mars',
    },
  };
}

/**
 * Saturn house change vs stored campaignEra — informational only (no gameplay rewards).
 * Returns null if era missing (caller seeds; do not treat seed as shift).
 */
export function checkEraShift(
  era: CampaignEra | null | undefined,
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[],
  today: string
): {
  shifted: true;
  newHouse: number;
  oldHouse: number;
  newDomain: string;
  newLabel: string;
  updatedEra: CampaignEra;
} | null {
  if (!era || !Number.isFinite(era.currentHouse)) return null;
  const newHouse = getSaturnTransitHouse(transitSnapshot, natalCusps);
  if (newHouse === era.currentHouse) return null;
  const info = getCampaignChapter(newHouse);
  return {
    shifted: true,
    newHouse,
    oldHouse: era.currentHouse,
    newDomain: info.domain,
    newLabel: info.thematicLabel,
    updatedEra: {
      currentHouse: newHouse,
      domain: info.domain,
      label: info.thematicLabel,
      enteredDate: today,
      transitBody: 'saturn',
    },
  };
}

/** @deprecated Prefer checkChapterTransition. */
export function ensureSaturnChapter(
  existing: SaturnChapterState | null | undefined,
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[],
  today: string
): { chapter: SaturnChapterState; backfilled: boolean } {
  if (existing && Number.isFinite(existing.currentHouse)) {
    return { chapter: existing, backfilled: false };
  }
  const house = getSaturnTransitHouse(transitSnapshot, natalCusps);
  return {
    chapter: buildSaturnChapterState(house, today, 0),
    backfilled: true,
  };
}

/** @deprecated Prefer checkChapterTransition. */
export function checkSaturnTransition(
  chapter: SaturnChapterState,
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[],
  today: string
): {
  transitioned: true;
  newHouse: number;
  oldHouse: number;
  newDomain: string;
  newLabel: string;
  updatedChapter: SaturnChapterState;
} | null {
  const newHouse = getSaturnTransitHouse(transitSnapshot, natalCusps);
  if (newHouse === chapter.currentHouse) return null;
  const info = getCampaignChapter(newHouse);
  return {
    transitioned: true,
    newHouse,
    oldHouse: chapter.currentHouse,
    newDomain: info.domain,
    newLabel: info.thematicLabel,
    updatedChapter: {
      startingHouse: chapter.startingHouse,
      currentHouse: newHouse,
      domain: info.domain,
      label: info.thematicLabel,
      enteredDate: today,
      transitionCount: chapter.transitionCount + 1,
    },
  };
}

/** Legendary relic for a house dungeon (milestone reward from departing house). */
export function findHouseRelic(saturnHouse: number): ItemDefinition | null {
  const maps = loadRpgV1Maps();
  const relics = maps.itemDefinitions.filter(
    (d) => d.saturnHouse === saturnHouse && d.category === 'relic' && d.rarity === 'legendary'
  );
  return relics.sort((a, b) => a.slug.localeCompare(b.slug))[0] ?? null;
}

export function checkStreakMilestones(params: {
  streak: number;
  slotsUnlocked: UnlockedSlot[];
  maxBagSize: number;
  flags: string[];
}): {
  newSlots: UnlockedSlot[];
  bagSizeIncrease: number;
  maxBagSize: number;
  flags: string[];
  events: MilestoneEvent[];
} {
  const slots = [...params.slotsUnlocked] as UnlockedSlot[];
  let bagIncrease = 0;
  let flags = [...params.flags];
  const events: MilestoneEvent[] = [];

  if (params.streak >= 7 && !slots.includes('accessory') && !flags.includes('milestone_streak_7')) {
    slots.push('accessory');
    flags.push('milestone_streak_7');
    events.push({
      type: 'streak_unlock',
      detail: 'Streak 7: accessory slot unlocked',
      slotsUnlocked: ['accessory'],
    });
  }

  if (
    params.streak >= 14 &&
    !slots.includes('consumable_2') &&
    !flags.includes('milestone_streak_14')
  ) {
    slots.push('consumable_2');
    flags.push('milestone_streak_14');
    events.push({
      type: 'streak_unlock',
      detail: 'Streak 14: second consumable slot unlocked',
      slotsUnlocked: ['consumable_2'],
    });
  }

  if (params.streak >= 30 && !flags.includes('milestone_streak_30')) {
    bagIncrease += 5;
    flags.push('milestone_streak_30');
    events.push({
      type: 'streak_bag',
      detail: 'Streak 30: bag size +5',
      bagSizeIncrease: 5,
    });
  }

  const maxBagSize = Math.min(MAX_BAG_SIZE_CAP, params.maxBagSize + bagIncrease);
  return {
    newSlots: slots,
    bagSizeIncrease: bagIncrease,
    maxBagSize,
    flags: Array.from(new Set(flags)).sort(),
    events,
  };
}

export function applyChapterTransitionRewards(params: {
  transition: NonNullable<ReturnType<typeof checkChapterTransition>>;
  chapterTransitionCountBefore: number;
  slotsUnlocked: UnlockedSlot[];
  maxBagSize: number;
  flags: string[];
  history: string[];
}): {
  slotsUnlocked: UnlockedSlot[];
  maxBagSize: number;
  flags: string[];
  history: string[];
  relic: ItemDefinition | null;
  unlockRelicSlot: boolean;
  chapterTransitionCount: number;
  events: MilestoneEvent[];
} {
  const t = params.transition;
  const nextCount = params.chapterTransitionCountBefore + 1;
  let slots = [...params.slotsUnlocked] as UnlockedSlot[];
  let unlockRelicSlot = false;
  // First Mars chapter transition unlocks relic slot
  if (nextCount === 1 && !slots.includes('relic')) {
    slots.push('relic');
    unlockRelicSlot = true;
  }

  const bagIncrease = 5;
  const maxBagSize = Math.min(MAX_BAG_SIZE_CAP, params.maxBagSize + bagIncrease);
  const flag = `chapter_transition_${t.oldHouse}_to_${t.newHouse}`;
  const flags = Array.from(new Set([...params.flags, flag])).sort();
  const oldInfo = getCampaignChapter(t.oldHouse);
  const history = [
    ...(params.history || []),
    `The dungeon shifted from ${oldInfo.thematicLabel} to ${t.newLabel}`,
  ].slice(-20);

  const relic = findHouseRelic(t.oldHouse);
  const events: MilestoneEvent[] = [
    {
      type: 'chapter_transition',
      detail: `Chapter ${t.oldHouse} → ${t.newHouse}: ${t.newLabel}`,
      slotsUnlocked: unlockRelicSlot ? ['relic'] : [],
      bagSizeIncrease: bagIncrease,
      relicGranted: relic,
    },
  ];

  return {
    slotsUnlocked: slots,
    maxBagSize,
    flags,
    history,
    relic,
    unlockRelicSlot,
    chapterTransitionCount: nextCount,
    events,
  };
}

/** Era shift: flag + history only — no relic, bag, or slot rewards. */
export function applyEraShift(params: {
  shift: NonNullable<ReturnType<typeof checkEraShift>>;
  flags: string[];
  history: string[];
}): {
  flags: string[];
  history: string[];
  events: MilestoneEvent[];
} {
  const s = params.shift;
  const flag = `era_shift_${s.oldHouse}_to_${s.newHouse}`;
  const flags = Array.from(new Set([...params.flags, flag])).sort();
  const oldInfo = getCampaignChapter(s.oldHouse);
  const history = [
    ...(params.history || []),
    `The weight of Saturn has moved from ${oldInfo.thematicLabel} to ${s.newLabel}`,
  ].slice(-20);
  const events: MilestoneEvent[] = [
    {
      type: 'era_shift',
      detail: `Era ${s.oldHouse} → ${s.newHouse}: ${s.newLabel}`,
    },
  ];
  return { flags, history, events };
}

/** @deprecated Prefer applyChapterTransitionRewards. */
export function applySaturnTransitionRewards(params: {
  transition: NonNullable<ReturnType<typeof checkSaturnTransition>>;
  slotsUnlocked: UnlockedSlot[];
  maxBagSize: number;
  flags: string[];
  history: string[];
}): {
  slotsUnlocked: UnlockedSlot[];
  maxBagSize: number;
  flags: string[];
  history: string[];
  relic: ItemDefinition | null;
  unlockRelicSlot: boolean;
  events: MilestoneEvent[];
} {
  const t = params.transition;
  let slots = [...params.slotsUnlocked] as UnlockedSlot[];
  let unlockRelicSlot = false;
  if (t.updatedChapter.transitionCount === 1 && !slots.includes('relic')) {
    slots.push('relic');
    unlockRelicSlot = true;
  }

  const bagIncrease = 5;
  const maxBagSize = Math.min(MAX_BAG_SIZE_CAP, params.maxBagSize + bagIncrease);
  const flag = `saturn_transition_${t.oldHouse}_to_${t.newHouse}`;
  const flags = Array.from(new Set([...params.flags, flag])).sort();
  const oldInfo = getCampaignChapter(t.oldHouse);
  const history = [
    ...(params.history || []),
    `Saturn moved from ${oldInfo.thematicLabel} to ${t.newLabel}`,
  ].slice(-20);

  const relic = findHouseRelic(t.oldHouse);
  const events: MilestoneEvent[] = [
    {
      type: 'saturn_transition',
      detail: `Saturn ${t.oldHouse} → ${t.newHouse}: ${t.newLabel}`,
      slotsUnlocked: unlockRelicSlot ? ['relic'] : [],
      bagSizeIncrease: bagIncrease,
      relicGranted: relic,
    },
  ];

  return {
    slotsUnlocked: slots,
    maxBagSize,
    flags,
    history,
    relic,
    unlockRelicSlot,
    events,
  };
}
