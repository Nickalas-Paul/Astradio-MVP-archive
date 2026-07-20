/**
 * Active buff / shield / reveal expiry and application helpers.
 */

import type { ActiveBuff, DamageShield } from '../rpg/types';

export function expireBuffs(buffs: ActiveBuff[] | undefined, today: string): ActiveBuff[] {
  return (buffs || []).filter((b) => b.expiresDate >= today);
}

export function expireShield(
  shield: DamageShield | null | undefined,
  today: string
): DamageShield | null {
  if (!shield) return null;
  if (shield.expiresDate < today) return null;
  return shield;
}

export function addCalendarDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function applyShieldToDamage(damage: number, shield: DamageShield | null): number {
  if (!shield || damage <= 0) return damage;
  const reduced = Math.floor(damage * (1 - Math.min(1, Math.max(0, shield.reduction))));
  return Math.max(1, reduced);
}
