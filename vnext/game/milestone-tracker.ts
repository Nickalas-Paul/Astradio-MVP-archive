/**
 * Streak milestones + Saturn house transition detection/rewards.
 */

import type { EphemerisSnapshot } from '../contracts';
import { getSaturnTransitHouse, getCampaignChapter } from '../rpg/saturn-house';
import { loadRpgV1Maps } from '../rpg/maps/load-v1';
import type {
  ItemDefinition,
  MilestoneEvent,
  SaturnChapterState,
  UnlockedSlot,
} from '../rpg/types';

export const MAX_BAG_SIZE_CAP = 50;

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

/** Legendary relic for a Saturn house (milestone reward). */
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
  // First transition (count becomes 1): unlock relic
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
