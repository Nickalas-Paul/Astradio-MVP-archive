/**
 * Structured Gemini prompts for encounter intro and outcome narration.
 */

import type { CharacterIdentityContext } from '../rpg/class-display';
import type {
  CharacterHP,
  ChoiceOption,
  CombatResolution,
  MechanicalEncounter,
  ObstacleEntry,
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

function formatRecentHistory(recentHistory: string[] | undefined): string {
  const history = (recentHistory || []).slice(0, 3).join(' | ') || 'First encounter in this chapter.';
  return history;
}

export function buildEncounterIntroPrompt(
  input: Omit<NarrativePromptInput, 'chosenOption' | 'combatResult' | 'primaryStatUsed'>
): string {
  const p = input.encounter.scene.primaryPressure;
  const chapter = resolveChapter(input);
  const id = input.characterIdentity;
  const s = input.statBlock;
  const hp = input.hp;
  const obstacle = resolveObstacle(input.encounter);
  const era = input.campaignEra;
  const eraLine = era?.label
    ? `CAMPAIGN ERA: A longer passage through ${era.label} adds underlying ${era.domain} themes beneath today's encounter.`
    : '';
  const equippedSummary = input.equippedItems.length ? input.equippedItems.join(', ') : 'nothing';
  const formattedHistory = formatRecentHistory(input.recentHistory);

  return `You are the Dungeon Master for an astrology-based RPG called Astradio.

SETTING: ${chapter.label} (the domain of ${chapter.domain})
${eraLine}

CHARACTER:
  Class: ${id.className} | Element: ${id.classElement} | Rising: ${id.risingName}
  Stats: VT ${s.vitality} · RES ${s.resilience} · CUN ${s.cunning} · CHR ${s.charm} · INT ${s.intuition} · WIL ${s.willpower}
  HP: ${hp.current}/${hp.max}
  Equipped: ${equippedSummary}

TODAY'S ENCOUNTER:
  Obstacle: ${obstacle.name} (${obstacle.type})
  Description: ${obstacle.brief}
  Difficulty: ${input.encounter.dc}
  Transit pressure: ${p.transitBody} ${p.aspectType} natal ${p.natalBody}
  Theme: ${input.encounter.scene.theme}

RECENT ENCOUNTERS:
${formattedHistory}

Write a 3-4 sentence encounter introduction in second person ("You").

REQUIREMENTS:
- Name "${obstacle.name}" explicitly in the scene. The player must know what they are facing.
- If recent encounters exist, reference them. The player's story in this dungeon is ongoing, not episodic. A returning obstacle type should feel like a pattern. A streak of successes should feel like momentum. A recent failure should still sting. One brief callback is enough; do not recap the full history.
- If the obstacle is a creature or rival, describe what it looks like and how it moves. If it is a puzzle, describe its mechanism. If it is a trap, describe the trigger. If it is a hazard, describe the environmental threat.
- Ground the encounter in ${chapter.label}. The setting is not generic fantasy; it is this specific dungeon.
- End on the moment of decision. The player is about to choose how to respond.

VOICE AND STYLE RULES (strict):
- Warm, strategic DM voice. Direct and specific, not flowery.
- Never recite transit data, planet names, or aspect terminology. The astrology is beneath the surface.
- Weave ${id.className} identity naturally through how the character perceives the obstacle. Do not template-open with class name.
- No "Listen for..." constructions. No em dashes. No transitions like "however," "indeed," "moreover."
- Concrete over atmospheric. If you write a sentence that could describe any encounter, cut it.
- WRONG: "The pathways hum with an inviting energy, drawing you deeper into its intricate web of connections."
- RIGHT: "The Disconnection Phantom drifts through the junction ahead of you, trailing severed light-threads behind it like a net. Two of your allied signal paths have already gone dark."

Keep it vivid, specific, and concise.`;
}

export function buildNarrativePrompt(input: NarrativePromptInput): string {
  const c = input.combatResult;
  const id = input.characterIdentity;
  const obstacle = resolveObstacle(input.encounter);
  const chapter = resolveChapter(input);
  const s = input.statBlock;
  const hp = input.hp;
  const era = input.campaignEra;
  const eraLine = era?.label
    ? `CAMPAIGN ERA: A longer passage through ${era.label} adds underlying ${era.domain} themes beneath today's encounter.`
    : '';
  const equippedSummary = input.equippedItems.length ? input.equippedItems.join(', ') : 'nothing';
  const lootName =
    c.lootResult.dropped && c.lootResult.item ? c.lootResult.item.name : 'none';
  const choiceStat = input.primaryStatUsed?.name || 'unknown';
  const woundLine = c.woundedTriggered ? 'THE CHARACTER HAS FALLEN. They are now wounded.' : '';
  const saveLine = c.streakSaved ? 'A streak save protected them from falling!' : '';
  const lostLine = c.itemLost ? `Lost item: ${c.itemLost.name}` : '';
  const lootDesc =
    c.lootResult.dropped && c.lootResult.item
      ? `If an item was found, describe discovering ${c.lootResult.item.name}: "${c.lootResult.item.description}"`
      : '';

  return `You are the Dungeon Master for an astrology-based RPG called Astradio.

SETTING: ${chapter.label} (the domain of ${chapter.domain})
${eraLine}

CHARACTER:
  Class: ${id.className} | Element: ${id.classElement} | Rising: ${id.risingName}
  Stats: VT ${s.vitality} · RES ${s.resilience} · CUN ${s.cunning} · CHR ${s.charm} · INT ${s.intuition} · WIL ${s.willpower}
  HP: ${hp.current}/${hp.max}
  Equipped: ${equippedSummary}

THE CHOICE: The player chose "${input.chosenOption.label}" (${input.chosenOption.symbolicGesture})
  Approach: ${input.chosenOption.posture} / ${input.chosenOption.modality}

ENCOUNTER RESULT:
  Obstacle faced: ${obstacle.name} (${obstacle.type})
  Choice made: ${input.chosenOption.label} (${choiceStat})
  Roll: ${c.dieRoll.raw} + ${c.dieRoll.modifier} (${choiceStat}) = ${c.dieRoll.total} vs DC ${input.encounter.dc}
  Outcome: ${c.outcome}
  Damage taken: ${c.damageDealt}
  Loot found: ${lootName}
  ${woundLine}
  ${saveLine}
  ${lostLine}

Write 3-5 sentences describing the outcome in second person.

REQUIREMENTS:
- Describe what happened to ${obstacle.name} as a result of the player's action.
- SUCCESS/CRITICAL: The obstacle is overcome. Describe how the player's approach worked.
- PARTIAL: The obstacle is contained but not defeated. The player managed it at a cost.
- FAILURE: The obstacle got the better of the player. Describe the consequence concretely.
- CRITICAL_FAILURE: The obstacle won decisively. The player took real damage or lost something.
- If an item was found, describe the player discovering it naturally. Do not use the word "loot."
${lootDesc}
- Same voice and style rules as the intro prompt.
- Warm, strategic DM voice. Direct and specific, not flowery.
- Never recite transit data, planet names, or aspect terminology.
- Weave ${id.className} identity naturally. Do not template-open with class name.
- No "Listen for..." constructions. No em dashes. No transitions like "however," "indeed," "moreover."
- Concrete over atmospheric.`;
}
