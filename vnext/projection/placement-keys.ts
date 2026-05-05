/**
 * Placement key construction from ephemeris snapshot
 * Builds PLCMT_* keys for insight library lookup
 */

import type { EphemerisSnapshot } from '../contracts';
import { lonToSign, lonToHouse } from '../astro/profile-from-snapshot';

export interface PlacementKey {
  planet: string; // "SUN"
  sign: string; // "ARIES"
  house: number; // 10
  signKey: string; // "PLCMT_SUN_ARIES"
  houseKey: string; // "PLCMT_SUN_HOUSE10"
  degInSign: number; // 15.7
}

/**
 * Build all placement keys for a chart snapshot
 * Returns array of PlacementKey objects (one per planet)
 */
export function buildPlacementKeys(snapshot: EphemerisSnapshot): PlacementKey[] {
  const cusps = snapshot.houses || [];
  const keys: PlacementKey[] = [];

  for (const planet of snapshot.planets || []) {
    const name = String(planet.name || '').toUpperCase();
    if (!name || typeof planet.lon !== 'number') continue;

    const { sign, degInSign } = lonToSign(planet.lon);
    const house = lonToHouse(planet.lon, cusps);

    keys.push({
      planet: name,
      sign: sign.toUpperCase(), // CRITICAL: Ensure uppercase to match library keys
      house,
      signKey: `PLCMT_${name}_${sign.toUpperCase()}`,
      houseKey: `PLCMT_${name}_HOUSE${house}`,
      degInSign,
    });
  }

  return keys;
}

/**
 * Planet priority for sectioning
 */
export const PLANET_TIERS = {
  core_identity: ['SUN', 'MOON'],
  personal_expression: ['MERCURY', 'VENUS', 'MARS'],
  growth_expansion: ['JUPITER', 'SATURN'],
  evolutionary_currents: ['URANUS', 'NEPTUNE', 'PLUTO'],
} as const;
