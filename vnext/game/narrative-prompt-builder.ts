/**
 * Structured Gemini prompts for encounter intro and outcome narration.
 */

import type {
  CharacterHP,
  ChoiceOption,
  CombatResolution,
  MechanicalEncounter,
  StatBlock,
} from '../rpg/types';

export interface NarrativeChapterContext {
  house: number;
  domain: string;
  label: string;
}

export interface NarrativePromptInput {
  characterClass: string;
  characterSubclass: string;
  characterRising: string;
  statBlock: StatBlock;
  hp: CharacterHP;
  equippedItems: string[];
  encounter: MechanicalEncounter;
  chosenOption: ChoiceOption;
  combatResult: CombatResolution;
  /** Mars-driven active dungeon chapter. */
  activeChapter: NarrativeChapterContext;
  /** Saturn-driven background era (optional). */
  campaignEra?: NarrativeChapterContext | null;
  campaignChapter: number;
  recentHistory: string[];
  /**
   * @deprecated Prefer activeChapter. Accepted for dual-read callers during migration.
   */
  saturnChapter?: NarrativeChapterContext;
}

function resolveChapter(input: {
  activeChapter?: NarrativeChapterContext | null;
  saturnChapter?: NarrativeChapterContext | null;
}): NarrativeChapterContext {
  const ch = input.activeChapter || input.saturnChapter;
  return {
    house: ch?.house ?? 1,
    domain: ch?.domain ?? 'self',
    label: ch?.label ?? 'The road ahead',
  };
}

function toneGuidance(body: string): string {
  const b = body.toLowerCase();
  if (b === 'mars') return 'sharp, confrontational, and kinetic';
  if (b === 'saturn') return 'heavy, exacting, and structural';
  if (b === 'pluto') return 'intense, irreversible, and deep';
  if (b === 'uranus') return 'sudden, electric, and disruptive';
  if (b === 'neptune') return 'foggy, dissolving, and dreamlike';
  if (b === 'jupiter') return 'expansive, excessive, and optimistic';
  if (b === 'mercury') return 'quick, verbal, and restless';
  if (b === 'venus') return 'relational, indulgent, and magnetic';
  if (b === 'moon') return 'emotional, tidal, and intimate';
  return 'focused, personal, and clarifying';
}

function characterBlock(
  input: Omit<NarrativePromptInput, 'chosenOption' | 'combatResult'>
): string {
  const s = input.statBlock;
  const hp = input.hp;
  const chapter = resolveChapter(input);
  const era = input.campaignEra;
  const lines = [
    `SETTING: ${chapter.label} (the domain of ${chapter.domain})`,
    `CHARACTER: A ${input.characterClass} / ${input.characterSubclass} with ${input.characterRising} rising`,
    `  Stats: Vitality ${s.vitality}, Resilience ${s.resilience}, Cunning ${s.cunning}, Charm ${s.charm}, Intuition ${s.intuition}, Willpower ${s.willpower}`,
    `  HP: ${hp.current}/${hp.max}${hp.wounded ? ' (WOUNDED)' : ''}`,
    `  Equipped: ${input.equippedItems.length ? input.equippedItems.join(', ') : 'nothing'}`,
  ];
  if (era?.label) {
    lines.splice(
      1,
      0,
      `CAMPAIGN ERA: A longer passage through ${era.label} adds underlying ${era.domain} themes beneath today's encounter.`
    );
  }
  return lines.join('\n');
}

function chapterInstructions(input: {
  activeChapter?: NarrativeChapterContext | null;
  saturnChapter?: NarrativeChapterContext | null;
  campaignEra?: NarrativeChapterContext | null;
}): string {
  const chapter = resolveChapter(input);
  const era = input.campaignEra;
  const eraLine = era?.label
    ? `The campaign era (${era.label}) adds background thematic weight.`
    : '';
  return `The chapter setting (${chapter.label}) drives the encounter environment. ${eraLine}
Do not name Mars, Saturn, or any planet directly in the narration. Let the themes speak through the scene.`.trim();
}

export function buildEncounterIntroPrompt(
  input: Omit<NarrativePromptInput, 'chosenOption' | 'combatResult'>
): string {
  const p = input.encounter.scene.primaryPressure;
  const history = (input.recentHistory || []).slice(0, 3).join(' | ') || 'none';
  const chapter = resolveChapter(input);
  return `You are the Dungeon Master for an astrology-based RPG called Astradio.

${characterBlock(input)}

TODAY'S ENCOUNTER:
  Transit trigger: ${p.transitBody} ${p.aspectType} natal ${p.natalBody}
  Theme: ${input.encounter.scene.theme}
  Obstacle: ${input.encounter.scene.obstacle}
  Difficulty: ${input.encounter.dc}

Recent events: ${history}

Write a 3-4 sentence encounter introduction in second person ("You").
Set the scene in ${chapter.label}.
${chapterInstructions(input)}
The tone should match the transit energy: ${input.encounter.transitBodyCategory} transits feel ${toneGuidance(input.encounter.transitBodyCategory)}.
Do not describe the choices or outcome. Just set the scene and present the obstacle.

VOICE AND STYLE RULES (strict):
- You are a warm, strategic tabletop DM. Direct and confident, never precious.
- The transit data above informs the SITUATION you describe. Never recite it. Never write planet names, aspect names, or phrases like "mars meets mercury" in the narration.
- Never open with "As a ${input.characterClass}, you..." or any "As a [class/sign], you..." construction.
- No "Listen for..." constructions.
- No em dashes. Use commas, periods, or semicolons.
- Never use "however," "indeed," "moreover," or "furthermore."
- Call equipment "items," "gear," or "equipment," never "artifacts."
Keep it vivid but concise.`;
}

export function buildNarrativePrompt(input: NarrativePromptInput): string {
  const c = input.combatResult;
  const lootLine = c.lootResult.dropped && c.lootResult.item
    ? `Loot found: ${c.lootResult.item.name}`
    : 'No loot found';
  const woundLine = c.woundedTriggered ? 'THE CHARACTER HAS FALLEN. They are now wounded.' : '';
  const saveLine = c.streakSaved ? 'A streak save protected them from falling!' : '';
  const lostLine = c.itemLost ? `Lost item: ${c.itemLost.name}` : '';
  const lootDesc =
    c.lootResult.dropped && c.lootResult.item
      ? `If loot was found, describe discovering ${c.lootResult.item.name}: "${c.lootResult.item.description}"`
      : '';

  return `You are the Dungeon Master for an astrology-based RPG called Astradio.

${characterBlock(input)}

THE CHOICE: The player chose "${input.chosenOption.label}" (${input.chosenOption.symbolicGesture})
  Approach: ${input.chosenOption.posture} / ${input.chosenOption.modality}

THE RESULT:
  Die roll: ${c.dieRoll.raw} + ${c.dieRoll.modifier} modifier = ${c.dieRoll.total} vs DC ${input.encounter.dc}
  Outcome: ${c.outcome}
  Damage taken: ${c.damageDealt}
  HP: ${c.hpAfter}/${input.hp.max}
  ${lootLine}
  ${woundLine}
  ${saveLine}
  ${lostLine}

Write a 4-6 sentence outcome narration in second person.
Describe how the choice played out given the die result.
${lootDesc}
If wounded, make it dramatic but not grim -- this is a setback, not an ending.
If streak saved, describe a narrow escape.
Match the energy of a ${c.outcome} result.
${chapterInstructions(input)}

VOICE AND STYLE RULES (strict):
- You are a warm, strategic tabletop DM. Direct and confident, never precious.
- The transit and stat data above informs WHAT happened. Never recite it. No planet names, aspect names, or astrology notation in the narration.
- Never open with "As a [class/sign], you..." and no "Listen for..." constructions. No template openings.
- No em dashes. Use commas, periods, or semicolons.
- Never use "however," "indeed," "moreover," or "furthermore."
- Call equipment "items," "gear," or "equipment," never "artifacts."`;
}
