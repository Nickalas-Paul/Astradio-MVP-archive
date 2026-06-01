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

  if (cusps.length >= 1 && typeof cusps[0] === 'number' && Number.isFinite(cusps[0])) {
    const { sign, degInSign } = lonToSign(cusps[0]);
    const ascSign = sign.toUpperCase();
    keys.push({
      planet: 'ASCENDANT',
      sign: ascSign,
      house: 1,
      signKey: `PLCMT_ASCENDANT_${ascSign}`,
      houseKey: `PLCMT_ASCENDANT_${ascSign}_HOUSE1`,
      degInSign,
    });
  }

  if (cusps.length >= 10 && typeof cusps[9] === 'number' && Number.isFinite(cusps[9])) {
    const { sign, degInSign } = lonToSign(cusps[9]);
    const mcSign = sign.toUpperCase();
    keys.push({
      planet: 'MC',
      sign: mcSign,
      house: 10,
      signKey: `PLCMT_MC_${mcSign}`,
      houseKey: `PLCMT_MC_${mcSign}_HOUSE10`,
      degInSign,
    });
  }

  if (cusps.length >= 4 && typeof cusps[3] === 'number' && Number.isFinite(cusps[3])) {
    const { sign, degInSign } = lonToSign(cusps[3]);
    const icSign = sign.toUpperCase();
    keys.push({
      planet: 'IC',
      sign: icSign,
      house: 4,
      signKey: `PLCMT_IC_${icSign}`,
      houseKey: `PLCMT_IC_${icSign}_HOUSE4`,
      degInSign,
    });
  }

  return keys;
}

/**
 * Planet priority for sectioning
 */
export const PLANET_TIERS = {
  core_identity: ['SUN', 'MOON', 'ASCENDANT'],
  direction_foundation: ['MC', 'IC'],
  personal_expression: ['MERCURY', 'VENUS', 'MARS'],
  growth_expansion: ['JUPITER', 'SATURN'],
  evolutionary_currents: ['URANUS', 'NEPTUNE', 'PLUTO', 'CHIRON'],
} as const;
