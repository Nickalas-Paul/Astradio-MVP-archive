/**
 * Wraps ChallengeScene with mechanical encounter metadata.
 * Does not modify the challenge generator.
 */

import type { EphemerisSnapshot } from '../contracts';
import { getMarsTransitHouse, getCampaignChapter } from '../rpg/saturn-house';
import { selectObstacle } from '../rpg/obstacle-selector';
import type { ChallengeScene, CharacterProfile, MechanicalEncounter } from '../rpg/types';
import { buildChoiceStatMap } from './choice-stat-map';
import { baseDamageForTransitBody, transitBodyCategory } from './damage-tables';

function deterministicJitter(date: string, campaignId: string): number {
  let hash = 0;
  const seed = date + campaignId;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 5) - 2;
}

export function computeDC(
  intensityScore: number,
  campaignChapter: number,
  calendarDate: string,
  campaignId: string,
  wounded = false
): number {
  const score = Number.isFinite(intensityScore) ? intensityScore : 0.5;
  const baseDC = Math.round(6 + score * 14);
  const jitter = deterministicJitter(calendarDate, campaignId);
  const chapterBonus = Math.floor(Math.max(0, campaignChapter) / 10);
  const woundedMod = wounded ? -2 : 0;
  return Math.max(5, Math.min(19, baseDC + jitter + chapterBonus + woundedMod));
}

export function buildMechanicalEncounter(
  scene: ChallengeScene,
  _characterProfile: CharacterProfile,
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[],
  campaignChapter: number,
  options?: {
    wounded?: boolean;
    calendarDate?: string;
    campaignId?: string;
    intensityScore?: number;
  }
): MechanicalEncounter {
  const primary = scene.primaryPressure;
  const body = transitBodyCategory(primary.transitBody);
  // Mars drives active dungeon / loot table selection (~6–8 week chapters).
  const marsHouse = getMarsTransitHouse(transitSnapshot, natalCusps);
  const chapter = getCampaignChapter(marsHouse);
  const calendarDate = options?.calendarDate || '';
  const campaignId = options?.campaignId || '';
  const intensityScore =
    typeof options?.intensityScore === 'number' ? options.intensityScore : primary.intensity ?? 0.5;
  const obstacle = selectObstacle(marsHouse, calendarDate, campaignId);
  const sceneWithObstacle: ChallengeScene = {
    ...scene,
    obstacle,
  };

  return {
    scene: sceneWithObstacle,
    dc: computeDC(intensityScore, campaignChapter, calendarDate, campaignId, !!options?.wounded),
    baseDamage: baseDamageForTransitBody(primary.transitBody),
    transitBodyCategory: body,
    // TODO: rename field to chapterHouse — value is now Mars-derived
    saturnHouse: marsHouse,
    lootTableKey: chapter.lootTableKey,
    choiceStatMap: buildChoiceStatMap(scene.choices || []),
    intensityBand: primary.intensityBand,
  };
}
