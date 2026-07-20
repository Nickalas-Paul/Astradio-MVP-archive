/**
 * Max HP derivation, damage application, wounded state, streak tracking.
 */

import type { CharacterHP, StatBlock } from '../rpg/types';

export function deriveMaxHp(stats: Pick<StatBlock, 'vitality' | 'resilience'>): number {
  return 20 + stats.vitality * 3 + stats.resilience * 2;
}

export function createFullHp(stats: Pick<StatBlock, 'vitality' | 'resilience'>): CharacterHP {
  const max = deriveMaxHp(stats);
  return {
    current: max,
    max,
    wounded: false,
    woundedUntil: null,
    woundedDaysRemaining: 0,
  };
}

/** Recovery days: 3 base, -1 per Resilience above 12, min 1. */
export function woundedRecoveryDays(resilience: number): number {
  const reduction = Math.max(0, resilience - 12);
  return Math.max(1, 3 - reduction);
}

export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(earlier: string, later: string): number {
  const a = new Date(`${earlier}T12:00:00.000Z`).getTime();
  const b = new Date(`${later}T12:00:00.000Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function isYesterday(lastPlayed: string, today: string): boolean {
  return daysBetween(lastPlayed, today) === 1;
}

export function updateStreak(
  streak: number,
  lastPlayedDate: string | null,
  today: string
): { streak: number; lastPlayedDate: string; streakReset: boolean } {
  if (lastPlayedDate === today) {
    return { streak, lastPlayedDate: today, streakReset: false };
  }
  if (lastPlayedDate && isYesterday(lastPlayedDate, today)) {
    return { streak: streak + 1, lastPlayedDate: today, streakReset: false };
  }
  return { streak: 1, lastPlayedDate: today, streakReset: true };
}

/**
 * Apply incoming damage with streak save. Mutates nothing — returns new HP + flags.
 */
export function applyDamageToHp(params: {
  hp: CharacterHP;
  damage: number;
  resilience: number;
  calendarDate: string;
  streak: number;
  flags: string[];
}): {
  hp: CharacterHP;
  damageDealt: number;
  woundedTriggered: boolean;
  streakSaved: boolean;
  flags: string[];
} {
  const { resilience, calendarDate, streak } = params;
  let flags = [...params.flags];
  const damage = Math.max(0, Math.floor(params.damage));
  let current = params.hp.current;
  let woundedTriggered = false;
  let streakSaved = false;

  if (damage <= 0) {
    return {
      hp: { ...params.hp },
      damageDealt: 0,
      woundedTriggered: false,
      streakSaved: false,
      flags,
    };
  }

  const wouldKill = current - damage <= 0;
  if (wouldKill && streak >= 7 && !flags.includes('near_death_save')) {
    current = 1;
    streakSaved = true;
    flags = Array.from(new Set([...flags, 'near_death_save'])).sort();
    return {
      hp: { ...params.hp, current },
      damageDealt: Math.max(0, params.hp.current - 1),
      woundedTriggered: false,
      streakSaved: true,
      flags,
    };
  }

  current = Math.max(0, current - damage);
  let hp: CharacterHP = { ...params.hp, current };

  if (current === 0) {
    const days = woundedRecoveryDays(resilience);
    hp = {
      ...hp,
      wounded: true,
      woundedUntil: addCalendarDays(calendarDate, days),
      woundedDaysRemaining: days,
    };
    woundedTriggered = true;
  }

  return { hp, damageDealt: damage, woundedTriggered, streakSaved, flags };
}

export function applyHeal(hp: CharacterHP, amount: number): CharacterHP {
  const heal = Math.max(0, Math.floor(amount));
  const current = Math.min(hp.max, hp.current + heal);
  const cleared = current > 0 && hp.wounded;
  if (!cleared) {
    return { ...hp, current };
  }
  return {
    current,
    max: hp.max,
    wounded: false,
    woundedUntil: null,
    woundedDaysRemaining: 0,
  };
}

/** Daily tick: +5 HP if not wounded; if wounded, decrement recovery. */
export function applyDailyRecovery(hp: CharacterHP): CharacterHP {
  if (hp.wounded) {
    const remaining = Math.max(0, hp.woundedDaysRemaining - 1);
    if (remaining === 0) {
      return {
        current: Math.floor(hp.max * 0.5),
        max: hp.max,
        wounded: false,
        woundedUntil: null,
        woundedDaysRemaining: 0,
      };
    }
    return {
      ...hp,
      woundedDaysRemaining: remaining,
    };
  }
  return applyHeal(hp, 5);
}

/** Wounded: all stats reduced 25%, floored, min 1. */
export function applyWoundedStatPenalty(stat: number, wounded: boolean): number {
  if (!wounded) return Math.max(1, Math.floor(stat));
  return Math.max(1, Math.floor(stat * 0.75));
}

export function ensureCharacterHp(
  hp: CharacterHP | undefined | null,
  stats: Pick<StatBlock, 'vitality' | 'resilience'>
): CharacterHP {
  if (hp && Number.isFinite(hp.max) && Number.isFinite(hp.current)) {
    const max = Math.max(hp.max, deriveMaxHp(stats));
    return {
      current: Math.min(Math.max(0, hp.current), max),
      max,
      wounded: !!hp.wounded,
      woundedUntil: hp.woundedUntil ?? null,
      woundedDaysRemaining: Math.max(0, hp.woundedDaysRemaining ?? 0),
    };
  }
  return createFullHp(stats);
}
