/**
 * Transit house occupancy + campaign chapter derivation.
 * Chapter dungeon selection is house-number-based; Mars now drives the active
 * chapter while Saturn drives the background era. Loot keys remain saturn_house_N.
 */

import type { EphemerisSnapshot } from '../contracts';
import { lonToHouse } from '../astro/profile-from-snapshot';
import { loadRpgV1Maps } from './maps/load-v1';
import type { CampaignChapterInfo } from './types';

/**
 * Which natal house is the named transit body currently occupying?
 * Uses transit body longitude against the natal house cusps.
 */
export function getTransitHouse(
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[],
  body: string
): number {
  if (!natalCusps || natalCusps.length < 12) {
    throw new Error('[saturn-house] natalCusps must have 12 house cusps');
  }
  const name = String(body || '').toLowerCase();
  const planet = (transitSnapshot.planets || []).find(
    (p) => String(p.name).toLowerCase() === name
  );
  if (!planet || !Number.isFinite(planet.lon)) {
    throw new Error(`[saturn-house] Transit snapshot missing ${body} longitude`);
  }
  const house = lonToHouse(planet.lon, [...natalCusps]);
  return Math.min(12, Math.max(1, house));
}

/** Mars natal-house occupancy — drives active dungeon chapter (~6–8 weeks). */
export function getMarsTransitHouse(
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[]
): number {
  return getTransitHouse(transitSnapshot, natalCusps, 'mars');
}

/**
 * Which natal house is transiting Saturn currently occupying?
 * Uses transit Saturn longitude against the natal house cusps.
 */
export function getSaturnTransitHouse(
  transitSnapshot: EphemerisSnapshot,
  natalCusps: number[]
): number {
  return getTransitHouse(transitSnapshot, natalCusps, 'saturn');
}

/** Map house number → dungeon label / domain / loot table key (planet-agnostic). */
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
