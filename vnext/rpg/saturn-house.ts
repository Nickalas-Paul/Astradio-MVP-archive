/**
 * Saturn transit house occupancy + campaign chapter derivation.
 */

import type { EphemerisSnapshot } from '../contracts';
import { lonToHouse } from '../astro/profile-from-snapshot';
import { loadRpgV1Maps } from './maps/load-v1';
import type { CampaignChapterInfo } from './types';

/**
 * Which natal house is transiting Saturn currently occupying?
 * Uses transit Saturn longitude against the natal house cusps.
 */
export function getSaturnTransitHouse(
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[]
): number {
  if (!natalCusps || natalCusps.length < 12) {
    throw new Error('[saturn-house] natalCusps must have 12 house cusps');
  }
  const saturn = (transitSnapshot.planets || []).find(
    (p) => String(p.name).toLowerCase() === 'saturn'
  );
  if (!saturn || !Number.isFinite(saturn.lon)) {
    throw new Error('[saturn-house] Transit snapshot missing Saturn longitude');
  }
  const house = lonToHouse(saturn.lon, [...natalCusps]);
  return Math.min(12, Math.max(1, house));
}

/** Map Saturn house → dungeon label / domain / loot table key. */
export function getCampaignChapter(saturnHouse: number): CampaignChapterInfo {
  const h = Math.min(12, Math.max(1, Math.floor(saturnHouse)));
  const maps = loadRpgV1Maps();
  const labels = maps.chapterLabels;
  const entry = labels[String(h)];
  if (!entry) {
    const domain = maps.houseArena[String(h)] ?? 'self';
    return {
      house: h,
      domain,
      lootTableKey: `saturn_house_${h}`,
      thematicLabel: `House ${h}`,
    };
  }
  return {
    house: entry.house,
    domain: entry.domain,
    lootTableKey: entry.lootTableKey,
    thematicLabel: entry.thematicLabel,
  };
}
