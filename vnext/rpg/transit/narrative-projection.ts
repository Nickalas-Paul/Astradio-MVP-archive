// vnext/rpg/transit/narrative-projection.ts
// Layer 3: Deterministic narrative prompt spec (IDs + tags only).

import type { TurnSeed, RPGDomainScore } from '../contracts';
import { loadRpgV1Maps } from '../maps/load-v1';
import { sha256Hex } from '../hash/json-hash';

export interface RpgPromptSpec {
  scenario_id: string;
  scenario_tags: string[];
  choice_ids: string[];
  choice_tags_by_id: Record<string, string[]>;
  outcome_patch_ids_by_choice: Record<string, string>;
  tone_tag: string;
}

function seedToInt(seed: TurnSeed, salt: string): number {
  const h = sha256Hex(`${salt}:${seed}`);
  const slice = h.slice(0, 8);
  const n = parseInt(slice, 16);
  return Number.isNaN(n) ? 0 : n >>> 0;
}

export function projectNarrativeFromDomains(
  seed: TurnSeed,
  domains: RPGDomainScore[]
): RpgPromptSpec {
  const maps = loadRpgV1Maps();
  const turnTemplates = maps.turnTemplates;
  const scenarioTemplates = maps.scenarioTemplates;
  const choiceTemplates = maps.choiceTemplates;

  const primaryDomain = domains[0]?.domain ?? 'identity_heat';

  const eligibleTurns = turnTemplates.filter((t: any) => t.dominant_domain === primaryDomain);
  const turnPool = eligibleTurns.length > 0 ? eligibleTurns : turnTemplates;

  if (!Array.isArray(turnPool) || turnPool.length === 0) {
    throw new Error('[rpg-transit] No turn templates available');
  }

  const turnIndex = seedToInt(seed, 'turn') % turnPool.length;
  const turn = turnPool[turnIndex];

  const scenarioIds: string[] = Array.isArray(turn.scenario_ids) ? turn.scenario_ids : [];
  if (scenarioIds.length === 0) {
    throw new Error('[rpg-transit] Turn template missing scenario_ids');
  }

  const scenariosMap = new Map<string, any>();
  for (const s of scenarioTemplates) {
    if (s && typeof s.id === 'string') {
      scenariosMap.set(s.id, s);
    }
  }

  const eligibleScenarios: any[] = [];
  for (const id of scenarioIds) {
    const s = scenariosMap.get(id);
    if (s) eligibleScenarios.push(s);
  }

  if (eligibleScenarios.length === 0) {
    throw new Error('[rpg-transit] No scenario templates resolved for turn');
  }

  const scenarioIndex = seedToInt(seed, 'scenario') % eligibleScenarios.length;
  const scenario = eligibleScenarios[scenarioIndex];

  const toneTag: string = scenario.tone_tag || turn.tone_tag || 'neutral';
  const scenarioTags: string[] = Array.isArray(scenario.scenario_tags)
    ? [...scenario.scenario_tags].sort()
    : [];

  const choiceIds: string[] = Array.isArray(scenario.choice_template_ids)
    ? scenario.choice_template_ids.slice()
    : [];

  if (choiceIds.length === 0) {
    throw new Error('[rpg-transit] Scenario template missing choice_template_ids');
  }

  const choiceMap = new Map<string, any>();
  for (const c of choiceTemplates) {
    if (c && typeof c.id === 'string') {
      choiceMap.set(c.id, c);
    }
  }

  const choiceTagsById: Record<string, string[]> = {};
  const outcomePatchIdsByChoice: Record<string, string> = {};
  const finalChoiceIds: string[] = [];

  for (const id of choiceIds) {
    const c = choiceMap.get(id);
    if (!c) continue;
    finalChoiceIds.push(id);
    const tags: string[] = Array.isArray(c.tags) ? [...c.tags].sort() : [];
    choiceTagsById[id] = tags;
    if (typeof c.outcome_patch_id === 'string') {
      outcomePatchIdsByChoice[id] = c.outcome_patch_id;
    }
  }

  if (finalChoiceIds.length === 0) {
    throw new Error('[rpg-transit] No valid choice templates resolved for scenario');
  }

  return {
    scenario_id: scenario.id,
    scenario_tags: scenarioTags,
    choice_ids: finalChoiceIds,
    choice_tags_by_id: choiceTagsById,
    outcome_patch_ids_by_choice: outcomePatchIdsByChoice,
    tone_tag: toneTag,
  };
}

