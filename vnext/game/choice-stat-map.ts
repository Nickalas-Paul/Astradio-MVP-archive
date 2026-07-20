/**
 * Maps choice outcomeDirection / posture → primary combat StatKey.
 */

import type { ChoiceOption, OutcomeDirection, ResponsePosture, StatKey } from '../rpg/types';

const DIRECTION_STAT: Record<OutcomeDirection, StatKey> = {
  assert_define: 'vitality',
  engage_advance: 'cunning',
  observe_hold: 'intuition',
  withdraw_protect: 'intuition',
  support_connect: 'charm',
  offer_restore: 'charm',
  reframe_integrate: 'willpower',
  contain_limit: 'resilience',
};

const POSTURE_STAT: Record<ResponsePosture, StatKey> = {
  assert: 'vitality',
  engage: 'cunning',
  observe: 'intuition',
  withdraw: 'intuition',
  support: 'charm',
  offer: 'charm',
  reframe: 'willpower',
  contain: 'resilience',
};

export function primaryStatForChoice(choice: ChoiceOption): StatKey {
  if (choice.outcomeDirection && DIRECTION_STAT[choice.outcomeDirection]) {
    return DIRECTION_STAT[choice.outcomeDirection];
  }
  if (choice.posture && POSTURE_STAT[choice.posture]) {
    return POSTURE_STAT[choice.posture];
  }
  return 'vitality';
}

export function buildChoiceStatMap(choices: ChoiceOption[]): Record<string, StatKey> {
  const out: Record<string, StatKey> = {};
  for (const c of choices) {
    out[c.id] = primaryStatForChoice(c);
  }
  return out;
}

/** Modifier = floor((stat - 10) / 2) */
export function statModifier(statValue: number): number {
  return Math.floor((statValue - 10) / 2);
}
