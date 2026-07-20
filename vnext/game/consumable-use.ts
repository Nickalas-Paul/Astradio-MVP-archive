/**
 * Consumable use before combat: heal / buff / shield / reveal.
 */

import { useConsumable } from '../rpg/inventory-manager';
import type {
  ActiveBuff,
  CharacterHP,
  ConsumableUseResult,
  DamageShield,
  InventoryState,
  ItemDefinition,
} from '../rpg/types';
import { applyHeal } from './hp-system';
import { addCalendarDaysIso } from './buff-manager';

export function applyConsumableEffect(params: {
  effect: import('../rpg/types').ConsumableEffect;
  hp: CharacterHP;
  calendarDate: string;
  activeBuffs: ActiveBuff[];
  damageShield: DamageShield | null;
  sourceSlug: string;
}): {
  hp: CharacterHP;
  activeBuffs: ActiveBuff[];
  damageShield: DamageShield | null;
  revealActive: boolean;
  woundedCleared: boolean;
  hpBefore: number;
  hpAfter: number;
} {
  const hpBefore = params.hp.current;
  let hp = { ...params.hp };
  let activeBuffs = [...params.activeBuffs];
  let damageShield = params.damageShield;
  let revealActive = false;
  let woundedCleared = false;

  if (params.effect.type === 'heal') {
    const wasWounded = hp.wounded;
    hp = applyHeal(hp, params.effect.magnitude);
    woundedCleared = wasWounded && !hp.wounded;
  } else if (params.effect.type === 'buff' && params.effect.stat) {
    const duration = params.effect.duration ?? 1;
    activeBuffs.push({
      stat: params.effect.stat,
      magnitude: params.effect.magnitude,
      expiresDate: addCalendarDaysIso(params.calendarDate, duration),
      source: params.sourceSlug,
    });
  } else if (params.effect.type === 'shield') {
    const duration = params.effect.duration ?? 1;
    damageShield = {
      reduction: Math.min(1, Math.max(0, params.effect.magnitude / 100)),
      expiresDate: addCalendarDaysIso(params.calendarDate, duration),
    };
  } else if (params.effect.type === 'reveal') {
    revealActive = true;
  }

  return {
    hp,
    activeBuffs,
    damageShield,
    revealActive,
    woundedCleared,
    hpBefore,
    hpAfter: hp.current,
  };
}

export function processConsumableUse(params: {
  inventoryState: InventoryState;
  instanceId: string;
  definitions: Map<string, ItemDefinition>;
  hp: CharacterHP;
  calendarDate: string;
  activeBuffs: ActiveBuff[];
  damageShield: DamageShield | null;
}): ConsumableUseResult & {
  hp: CharacterHP;
  activeBuffs: ActiveBuff[];
  damageShield: DamageShield | null;
  revealActive: boolean;
} {
  const equipped =
    params.inventoryState.equipped.consumable_1 === params.instanceId ||
    params.inventoryState.equipped.consumable_2 === params.instanceId;
  if (!equipped) {
    throw new Error('[consumable-use] Item must be equipped in a consumable slot');
  }

  const prior = params.inventoryState.items.find((i) => i.instanceId === params.instanceId);
  if (!prior) {
    throw new Error('[consumable-use] Item instance not found');
  }
  const sourceSlug = prior.slug;

  const used = useConsumable(params.inventoryState, params.instanceId, params.definitions);
  const applied = applyConsumableEffect({
    effect: used.effect,
    hp: params.hp,
    calendarDate: params.calendarDate,
    activeBuffs: params.activeBuffs,
    damageShield: params.damageShield,
    sourceSlug,
  });

  const itemConsumed = !used.state.items.some((i) => i.instanceId === params.instanceId);

  return {
    used: true,
    effect: used.effect,
    hpBefore: applied.hpBefore,
    hpAfter: applied.hpAfter,
    woundedCleared: applied.woundedCleared,
    itemConsumed,
    inventoryState: used.state,
    hp: applied.hp,
    activeBuffs: applied.activeBuffs,
    damageShield: applied.damageShield,
    revealActive: applied.revealActive,
  };
}
