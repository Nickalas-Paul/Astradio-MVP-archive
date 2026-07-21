/**
 * Template narration when Gemini is unavailable.
 * Plain-language DM voice: warm, direct, second person. No transit notation,
 * no stitched database fragments.
 */

import type { ChoiceOption, CombatResolution, MechanicalEncounter } from '../rpg/types';

const INTRO_OPENERS = [
  'The path ahead narrows, and the day has picked its ground:',
  'Something in the air shifts as you arrive. Today the pressure gathers around',
  'You feel it before you see it. The day has set its stage in',
  'The road bends toward trouble, the useful kind. Today it runs through',
];

const INTRO_CLOSERS = [
  'It will not resolve itself. How you meet it is up to you.',
  'It is waiting on your answer, and it will not wait politely.',
  'The moment is live. Choose how you step into it.',
  'You have faced worse, but this one still wants a real answer.',
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

function difficultyPhrase(dc: number): string {
  if (dc >= 16) return 'This is a serious test, the kind that leaves a mark either way.';
  if (dc >= 12) return 'This will take real effort, but it is well within reach.';
  return 'This is a manageable test if you keep your head.';
}

export function buildFallbackIntro(
  encounter: MechanicalEncounter,
  saturnChapter: { thematicLabel?: string; domain?: string; label?: string }
): string {
  const label = saturnChapter.thematicLabel || saturnChapter.label || 'familiar ground';
  const setting = (encounter.scene.setting || '').trim();
  const seed = encounter.dc + (encounter.scene.theme?.length ?? 0);

  const opener = `${pick(INTRO_OPENERS, seed)} ${label}.`;
  const settingLine = setting ? `Around you, ${setting.charAt(0).toLowerCase()}${setting.slice(1).replace(/\.*$/, '')}.` : '';
  const stakes = difficultyPhrase(encounter.dc);
  const closer = pick(INTRO_CLOSERS, seed + encounter.dc);

  return [opener, settingLine, stakes, closer]
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
