/**
 * Effective stats = base + gear + buffs, then wounded penalty.
 */

import type { ActiveBuff, EffectiveStatBlock, StatBlock, StatKey } from '../rpg/types';
import { applyWoundedStatPenalty } from './hp-system';

const STAT_KEYS: StatKey[] = [
  'vitality',
  'resilience',
  'cunning',
  'charm',
  'intuition',
  'willpower',
];

export function buffContributions(activeBuffs: ActiveBuff[]): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  for (const b of activeBuffs || []) {
    out[b.stat] = (out[b.stat] ?? 0) + b.magnitude;
  }
  return out;
}

export function computeEffectiveStatBlock(
  base: StatBlock,
  gearBonuses: Partial<Record<StatKey, number>>,
  activeBuffs: ActiveBuff[],
  wounded: boolean
): EffectiveStatBlock {
  const bonuses = { ...(gearBonuses || {}) };
  const buffs = buffContributions(activeBuffs);
  const result: EffectiveStatBlock = {
    vitality: 0,
    resilience: 0,
    cunning: 0,
    charm: 0,
    intuition: 0,
    willpower: 0,
    bonuses,
    buffs,
    woundedPenalty: wounded,
  };

  for (const key of STAT_KEYS) {
    const combined = (base[key] ?? 10) + (bonuses[key] ?? 0) + (buffs[key] ?? 0);
    result[key] = applyWoundedStatPenalty(combined, wounded);
  }
  return result;
}
