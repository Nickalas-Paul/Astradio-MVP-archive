/**
 * Template narration when Gemini is unavailable.
 */

import type { ChoiceOption, CombatResolution, MechanicalEncounter } from '../rpg/types';

export function buildFallbackIntro(
  encounter: MechanicalEncounter,
  saturnChapter: { thematicLabel?: string; domain?: string; label?: string }
): string {
  const label = saturnChapter.thematicLabel || saturnChapter.label || 'the current domain';
  const theme = encounter.scene.theme || '';
  const setting = encounter.scene.setting || '';
  const obstacle = encounter.scene.obstacle || '';
  const parts = [
    `You stand within ${label}.`,
    setting ? `The space feels like ${setting}.` : '',
    theme ? theme : '',
    obstacle ? obstacle : `A challenge rated DC ${encounter.dc} presses in.`,
  ].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
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
    ? `You chose "${choice.label}."`
    : 'You committed to a response.';
  const hpBit = `You stand at ${combat.hpAfter} HP.`;
  const lootBit =
    combat.lootResult?.dropped && combat.lootResult.item
      ? `You found ${combat.lootResult.item.name}.`
      : '';
  const woundBit = combat.woundedTriggered
    ? 'You have fallen and are now wounded. Recovery will take days.'
    : '';
  const saveBit = combat.streakSaved
    ? 'A streak save kept you on your feet at the last moment.'
    : '';
  const lostBit = combat.itemLost ? `Lost: ${combat.itemLost.name}.` : '';
  const dcBit = `(Roll ${combat.dieRoll.total} vs DC ${encounter.dc}.)`;

  return [choiceBit, base, dcBit, hpBit, lootBit, woundBit, saveBit, lostBit]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
