/**
 * Structured Gemini prompts for encounter intro and outcome narration.
 */

import type { CharacterIdentityContext } from '../rpg/class-display';
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

export interface PrimaryStatUsedContext {
  name: string;
  value: number;
  modifier: number;
  isStrength: boolean;
  isWeakness: boolean;
}

export interface NarrativePromptInput {
  characterClass: string;
  characterSubclass: string;
  characterRising: string;
  characterIdentity: CharacterIdentityContext;
  statBlock: StatBlock;
  hp: CharacterHP;
  equippedItems: string[];
  encounter: MechanicalEncounter;
  chosenOption: ChoiceOption;
  combatResult: CombatResolution;
  primaryStatUsed?: PrimaryStatUsedContext;
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
  input: Omit<NarrativePromptInput, 'chosenOption' | 'combatResult' | 'primaryStatUsed'>
): string {
  const s = input.statBlock;
  const hp = input.hp;
  const chapter = resolveChapter(input);
  const era = input.campaignEra;
  const id = input.characterIdentity;
  const lines = [
    `SETTING: ${chapter.label} (the domain of ${chapter.domain})`,
    'CHARACTER:',
    `  Class: ${id.className} (${id.classElement} — ${id.classRole})`,
    `  Subclass: ${id.subclassName}`,
    `  Rising: ${id.risingName}`,
    `  Identity: ${id.statProfile}`,
    `  Nature: ${id.classStrengths}`,
    `  Shadow: ${id.classShadow}`,
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

function outcomeStatContext(
  combat: CombatResolution,
  identity: CharacterIdentityContext,
  primary?: PrimaryStatUsedContext
): string {
  if (!primary) {
    return '';
  }
  const modSign = primary.modifier >= 0 ? '+' : '';
  const strengthLine = primary.isStrength
    ? 'one of their strongest stats'
    : primary.isWeakness
      ? 'one of their weakest stats'
      : 'a moderate stat for this character';

  let outcomeGuide: string;
  if (combat.outcome === 'critical_success' || combat.outcome === 'success') {
    outcomeGuide = `Show how their ${identity.className} nature served them in this approach.`;
  } else if (combat.outcome === 'critical_failure' || combat.outcome === 'failure') {
    outcomeGuide = `Show the limits of relying on ${primary.name} for a character whose real strength is ${identity.strongestStat.name}.`;
  } else {
    outcomeGuide = 'Show the mixed result: effort applied but not fully rewarded.';
  }

  return `STAT CONTEXT:
  The player chose a ${primary.name} approach (modifier: ${modSign}${primary.modifier}).
  ${primary.name} is ${strengthLine}.
  ${outcomeGuide}`;
}

export function buildEncounterIntroPrompt(
  input: Omit<NarrativePromptInput, 'chosenOption' | 'combatResult' | 'primaryStatUsed'>
): string {
  const p = input.encounter.scene.primaryPressure;
  const history = (input.recentHistory || []).slice(0, 3).join(' | ') || 'none';
  const chapter = resolveChapter(input);
  const id = input.characterIdentity;
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
- Weave the character's ${id.className} identity into the scene naturally. Their ${id.classElement} nature and tendency toward ${id.classStrengths} should color how they perceive and approach the encounter. Reference their strengths or shadows when they are relevant to the scene.
- Never use the template construction "As a [name], you..." to open. Instead, let the character's nature emerge through their reactions, instincts, and the details they notice.
- Example good: "The ground feels familiar beneath your feet, solid and patient, but something in the air resists your usual steadiness."
- Example bad: "As a Stonebinder, you feel the earth's energy."
- No "Listen for..." constructions.
- No em dashes. Use commas, periods, or semicolons.
- Never use "however," "indeed," "moreover," or "furthermore."
- Call equipment "items," "gear," or "equipment," never "artifacts."
Keep it vivid but concise.`;
}

export function buildNarrativePrompt(input: NarrativePromptInput): string {
  const c = input.combatResult;
  const id = input.characterIdentity;
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
  const statCtx = outcomeStatContext(c, id, input.primaryStatUsed);

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

${statCtx}

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
- Frame the outcome through the character's identity. A Stonebinder succeeding on Resilience should feel like the earth holding firm. A Stonebinder failing on Intuition should feel like solid ground offering no insight into shifting currents. The character's nature shapes HOW things happen, not just WHAT happens.
- Never open with "As a [class/sign], you..." and no "Listen for..." constructions. No template openings.
- No em dashes. Use commas, periods, or semicolons.
- Never use "however," "indeed," "moreover," or "furthermore."
- Call equipment "items," "gear," or "equipment," never "artifacts."`;
}
