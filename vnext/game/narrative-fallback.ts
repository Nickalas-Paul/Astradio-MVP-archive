/**
 * Template narration when Gemini is unavailable.
 * Plain-language DM voice: warm, direct, second person. No transit notation,
 * no stitched database fragments.
 */

import type { CharacterIdentityContext } from '../rpg/class-display';
import type { ChoiceOption, CombatResolution, MechanicalEncounter } from '../rpg/types';
import type { PrimaryStatUsedContext } from './narrative-prompt-builder';

const INTRO_OPENERS = [
  'shifts around you today',
  'is restless today',
  'opens before you, and the air has changed',
  'holds its breath as you arrive',
];

const ASPECT_FEEL: Record<string, string> = {
  conjunction: 'concentrated',
  square: 'tense',
  opposition: 'polarized',
  trine: 'flowing',
  sextile: 'quietly supportive',
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

function titleBody(body: string): string {
  const b = String(body || '').trim();
  return b ? b.charAt(0).toUpperCase() + b.slice(1).toLowerCase() : '';
}

export function buildFallbackIntro(
  encounter: MechanicalEncounter,
  activeChapter: { thematicLabel?: string; domain?: string; label?: string },
  identity?: CharacterIdentityContext | null
): string {
  const label = activeChapter.thematicLabel || activeChapter.label || 'The road ahead';
  const pressure = encounter.scene.primaryPressure;
  const setting = (encounter.scene.setting || '').trim().replace(/\.+$/, '');
  const seed = encounter.dc + (pressure?.transitBody?.length ?? 0);

  const opener = `${label} ${pick(INTRO_OPENERS, seed)}.`;

  const transit = titleBody(pressure?.transitBody);
  const natal = titleBody(pressure?.natalBody);
  const feel = ASPECT_FEEL[String(pressure?.aspectType || '').toLowerCase()] ?? 'charged';
  let energy = '';
  if (transit && natal) {
    energy = setting
      ? `A ${feel} energy runs between ${transit} and your natal ${natal}, and it finds you in ${setting}.`
      : `A ${feel} energy runs between ${transit} and your natal ${natal}.`;
  } else if (setting) {
    energy = `Something is stirring in ${setting}.`;
  }

  const className = identity?.className;
  const closer = className
    ? pick(
        [
          `Hold the ${className} in you close; this will ask for a real answer.`,
          `The stakes are real, and the ${className} in you already senses where the ground is soft.`,
        ],
        seed + encounter.dc
      )
    : pick(
        [
          'The stakes are visible, and the ground is not quite steady.',
          'It will ask for a real answer before the day is out.',
        ],
        seed + encounter.dc
      );

  return [opener, energy, closer]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const OUTCOME_LINES: Record<CombatResolution['outcome'], string> = {
  critical_success:
    'Your instincts proved sharp. The challenge yielded completely, and something valuable caught your eye in the aftermath.',
  success:
    'You met the challenge squarely. The obstacle gave way, and you moved forward with your footing intact.',
  partial: 'The encounter left its mark, but you held your ground. Not every day is a clean victory.',
  failure: "The challenge struck harder than expected. You'll carry this one forward.",
  critical_failure:
    "A blow you didn't see coming. Something slipped from your grasp in the aftermath.",
};

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
  const base = OUTCOME_LINES[combat.outcome] || OUTCOME_LINES.partial;
  const choiceBit = choice?.label
    ? `You chose to ${choice.label.charAt(0).toLowerCase()}${choice.label.slice(1)}.`
    : 'You committed to a response.';
  const identityBit = identityOutcomeLine(combat, identity, primaryStatUsed);
  const lootBit =
    combat.lootResult?.dropped && combat.lootResult.item
      ? `In the aftermath you found ${combat.lootResult.item.name}. It goes in your gear.`
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
