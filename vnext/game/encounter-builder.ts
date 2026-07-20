/**
 * Wraps ChallengeScene with mechanical encounter metadata.
 * Does not modify the challenge generator.
 */

import type { EphemerisSnapshot } from '../contracts';
import { getSaturnTransitHouse, getCampaignChapter } from '../rpg/saturn-house';
import type { ChallengeScene, CharacterProfile, MechanicalEncounter } from '../rpg/types';
import { buildChoiceStatMap } from './choice-stat-map';
import { baseDamageForTransitBody, transitBodyCategory } from './damage-tables';

const INTENSITY_DC: Record<string, number> = {
  low: 8,
  moderate: 11,
  high: 14,
  critical: 17,
};

export function computeDC(
  primaryPressure: ChallengeScene['primaryPressure'],
  campaignChapter: number,
  wounded = false
): number {
  const band = primaryPressure?.intensityBand ?? 'moderate';
  let dc = INTENSITY_DC[band] ?? 11;
  dc += Math.floor(Math.max(0, campaignChapter) / 10);
  if (wounded) dc = Math.max(1, dc - 2);
  return dc;
}

export function buildMechanicalEncounter(
  scene: ChallengeScene,
  _characterProfile: CharacterProfile,
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[],
  campaignChapter: number,
  options?: { wounded?: boolean }
): MechanicalEncounter {
  const primary = scene.primaryPressure;
  const body = transitBodyCategory(primary.transitBody);
  const saturnHouse = getSaturnTransitHouse(transitSnapshot, natalCusps);
  const chapter = getCampaignChapter(saturnHouse);

  return {
    scene,
    dc: computeDC(primary, campaignChapter, !!options?.wounded),
    baseDamage: baseDamageForTransitBody(primary.transitBody),
    transitBodyCategory: body,
    saturnHouse,
    lootTableKey: chapter.lootTableKey,
    choiceStatMap: buildChoiceStatMap(scene.choices || []),
    intensityBand: primary.intensityBand,
  };
}
