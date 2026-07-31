/**
 * Template narration when Gemini is unavailable.
 * Plain-language DM voice: warm, direct, second person. No transit notation,
 * no stitched database fragments.
 */

import type { CharacterIdentityContext } from '../rpg/class-display';
import type { ChoiceOption, CombatResolution, MechanicalEncounter, ObstacleEntry } from '../rpg/types';
import type { EquippedItemContext, PrimaryStatUsedContext } from './narrative-prompt-builder';

function resolveObstacle(encounter: MechanicalEncounter): ObstacleEntry {
  const o = encounter.scene?.obstacle;
  if (o && typeof o === 'object' && 'name' in o && o.name) {
    return o;
  }
  return {
    name: 'Unresolved Pressure',
    type: 'hazard',
    brief: 'A pressure in the path ahead.',
  };
}

export function buildFallbackIntro(
  encounter: MechanicalEncounter,
  activeChapter: { thematicLabel?: string; domain?: string; label?: string },
  identity?: CharacterIdentityContext | null,
  equippedItems: EquippedItemContext[] = []
): string {
  const dungeonLabel = activeChapter.thematicLabel || activeChapter.label || 'The road ahead';
  const obstacle = resolveObstacle(encounter);
  const introByType: Record<string, string> = {
    creature: `You round the corner in ${dungeonLabel} and find ${obstacle.name} blocking your path. ${obstacle.brief}`,
    rival: `A familiar tension fills the air in ${dungeonLabel}. ${obstacle.name} is here. ${obstacle.brief}`,
    puzzle: `The corridor in ${dungeonLabel} dead-ends at ${obstacle.name}. ${obstacle.brief}`,
    trap: `Something shifts underfoot in ${dungeonLabel}. You have walked into ${obstacle.name}. ${obstacle.brief}`,
    hazard: `The air changes in ${dungeonLabel}. ${obstacle.name} has begun. ${obstacle.brief}`,
  };
  const opener = introByType[obstacle.type] || introByType.hazard!;
  const className = identity?.className;
  const closer = className
    ? `The ${className} in you already senses what this will ask.`
    : 'The stakes are visible, and the ground is not quite steady.';
  const first = equippedItems[0];
  const gearNote = first
    ? ` Your ${first.name} ${
        first.category === 'armor'
          ? 'sits heavy on your shoulders'
          : first.category === 'weapon'
            ? 'is ready at your side'
            : 'pulses faintly'
      }.`
    : '';

  return [opener + gearNote, closer]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function identityOutcomeLine(
  combat: CombatResolution,
  identity: CharacterIdentityContext | null | undefined,
  primary: PrimaryStatUsedContext | null | undefined
): string {
  if (!identity?.className) return '';
  const statName = primary?.name || 'this approach';
  if (combat.outcome === 'critical_success' || combat.outcome === 'success') {
    if (primary?.isStrength) {
      return `The ${identity.className}'s nature wins the day. Your ${statName} carries the moment exactly as your strengths intended.`;
    }
    return `The ${identity.className} in you finds a path through.`;
  }
  if (combat.outcome === 'critical_failure' || combat.outcome === 'failure') {
    if (primary?.isWeakness) {
      return `This wasn't your kind of fight. ${statName} asked for something the ${identity.className}'s toolkit doesn't easily provide.`;
    }
    return `Even a ${identity.className} has limits, and today found one.`;
  }
  return `The ${identity.className} in you holds, but not without cost.`;
}

export function buildFallbackOutcome(
  encounter: MechanicalEncounter,
  choice: ChoiceOption,
  combat: CombatResolution,
  identity?: CharacterIdentityContext | null,
  primaryStatUsed?: PrimaryStatUsedContext | null
): string {
  const obstacle = resolveObstacle(encounter);
  const dungeonLabel =
    encounter.scene?.setting?.trim() ||
    'the dungeon';
  const damage = combat.damageDealt || 0;
  const outcomeTemplates: Record<string, string> = {
    success: `You overcame ${obstacle.name}. The way forward in ${dungeonLabel} is clear.`,
    partial: `You contained ${obstacle.name}, but it cost you. ${damage} damage taken.`,
    failure: `${obstacle.name} got the better of you today. ${damage} damage taken. The path remains, but the lesson stings.`,
    critical_success: `You dismantled ${obstacle.name} completely. ${dungeonLabel} yields to you.`,
    critical_failure: `${obstacle.name} overwhelmed you. ${damage} damage taken. You retreat to regroup.`,
  };
  const base = outcomeTemplates[combat.outcome] || outcomeTemplates.partial!;
  const choiceBit = choice?.label
    ? `You chose to ${choice.label.charAt(0).toLowerCase()}${choice.label.slice(1)}.`
    : 'You committed to a response.';
  const identityBit = identityOutcomeLine(combat, identity, primaryStatUsed);
  const lootName =
    combat.lootResult?.dropped && combat.lootResult.item ? combat.lootResult.item.name : '';
  const lootBit = lootName
    ? `Something catches your eye in the aftermath — ${lootName}, left behind by the encounter.`
    : '';
  const woundBit = combat.woundedTriggered
    ? 'You have fallen and are now wounded. Recovery will take a few days, and the campaign waits for you.'
    : '';
  const saveBit = combat.streakSaved
    ? 'At the last moment something held, and you stayed on your feet.'
    : '';
  const lostBit = combat.itemLost ? `${combat.itemLost.name} was lost in the exchange.` : '';

  return [choiceBit, base, identityBit, saveBit, woundBit, lootBit, lostBit]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
