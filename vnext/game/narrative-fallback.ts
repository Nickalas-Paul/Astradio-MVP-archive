/**
 * Template narration when Gemini is unavailable.
 * Plain-language DM voice: warm, direct, second person. No transit notation,
 * no stitched database fragments.
 */

import type { ChoiceOption, CombatResolution, MechanicalEncounter } from '../rpg/types';

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

function signFromClassSlug(classSlug?: string): string {
  const sign = String(classSlug || '')
    .replace(/^class_/, '')
    .trim();
  return sign ? sign.charAt(0).toUpperCase() + sign.slice(1) : '';
}

export function buildFallbackIntro(
  encounter: MechanicalEncounter,
  saturnChapter: { thematicLabel?: string; domain?: string; label?: string },
  classSlug?: string
): string {
  const label = saturnChapter.thematicLabel || saturnChapter.label || 'The road ahead';
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

  const sign = signFromClassSlug(classSlug);
  const closer = sign
    ? pick(
        [
          `Hold your ${sign} steadiness close; this will ask for a real answer.`,
          `The stakes are real, and your ${sign} instincts already sense where the ground is soft.`,
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

export function buildFallbackOutcome(
  encounter: MechanicalEncounter,
  choice: ChoiceOption,
  combat: CombatResolution
): string {
  const base = OUTCOME_LINES[combat.outcome] || OUTCOME_LINES.partial;
  const choiceBit = choice?.label
    ? `You chose to ${choice.label.charAt(0).toLowerCase()}${choice.label.slice(1)}.`
    : 'You committed to a response.';
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

  return [choiceBit, base, saveBit, woundBit, lootBit, lostBit]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
