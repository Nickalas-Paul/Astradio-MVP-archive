/**
 * Phase 4A — Sandbox snapshot with overrides.
 * Produces a REAL EphemerisSnapshot from birth data + planet overrides.
 * Recalculates aspects and dominantElements deterministically.
 */

import type { EphemerisSnapshot, SandboxBirth, SandboxOverrides, PlanetKey } from '../contracts';

const PLANET_ORDER: PlanetKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

/**
 * Calculate aspects between planets from positions object.
 * Same logic as server/index.js calcAspects.
 */
function calcAspects(positions: Record<string, number>): Array<{ p1: string; p2: string; type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition'; angle: number; orb: number; separation: number }> {
  const aspects: Array<{ p1: string; p2: string; type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition'; angle: number; orb: number; separation: number }> = [];
  const aspectTypes = {
    conjunction: { angle: 0, orb: 8 },
    opposition: { angle: 180, orb: 7 },
    trine: { angle: 120, orb: 6 },
    square: { angle: 90, orb: 6 },
    sextile: { angle: 60, orb: 5 }
  };
  
  const planetNames = Object.keys(positions);
  
  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const p1 = planetNames[i];
      const p2 = planetNames[j];
      const lon1 = positions[p1];
      const lon2 = positions[p2];
      
      // Calculate angular separation
      let separation = Math.abs(lon1 - lon2);
      if (separation > 180) separation = 360 - separation;
      
      // Check for aspects
      for (const [type, config] of Object.entries(aspectTypes)) {
        const orb = Math.abs(separation - config.angle);
        if (orb <= config.orb) {
          aspects.push({
            p1,
            p2,
            type: type as 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition',
            angle: config.angle,
            orb,
            separation
          });
        }
      }
    }
  }
  
  return aspects;
}

/**
 * Calculate dominant elements from positions.
 * Same logic as server/index.js calcDominantElements.
 */
function calcDominantElements(positions: Record<string, number>): { fire: number; earth: number; air: number; water: number } {
  const elementPlanets = {
    fire: ['sun', 'mars', 'jupiter'],
    earth: ['venus', 'saturn'],
    air: ['mercury', 'uranus'],
    water: ['moon', 'neptune', 'pluto']
  };
  
  const elementCounts = { fire: 0, earth: 0, air: 0, water: 0 };
  
  for (const [planet, lon] of Object.entries(positions)) {
    for (const [element, planets] of Object.entries(elementPlanets)) {
      if (planets.includes(planet)) {
        elementCounts[element as keyof typeof elementCounts]++;
        break;
      }
    }
  }
  
  // Calculate weights
  const total = Object.values(elementCounts).reduce((sum, count) => sum + count, 0);
  const weights: { fire: number; earth: number; air: number; water: number } = {
    fire: total > 0 ? elementCounts.fire / total : 0.25,
    earth: total > 0 ? elementCounts.earth / total : 0.25,
    air: total > 0 ? elementCounts.air / total : 0.25,
    water: total > 0 ? elementCounts.water / total : 0.25,
  };
  
  return weights;
}

/**
 * Calculate moon phase (normalized 0-1) from Sun and Moon longitudes.
 */
function calcMoonPhase(sunLon: number, moonLon: number): number {
  let phase = (moonLon - sunLon) / 360;
  if (phase < 0) phase += 1;
  return phase;
}

/**
 * Validate overrides: longitudes 0-360 (or normalized); angles explicitly unsupported in 4A.
 */
export function validateSandboxOverrides(overrides: SandboxOverrides): void {
  const angles = overrides.angles;
  if (angles && (angles.ascDeg !== undefined || angles.mcDeg !== undefined)) {
    throw new Error('Angle overrides (ASC/MC) are not supported in this version. Use planet longitude overrides only.');
  }
  const planets = overrides.planets || {};
  for (const [key, val] of Object.entries(planets)) {
    if (val && typeof val.lonDeg !== 'number') {
      throw new Error(`Override for ${key}: lonDeg must be a number.`);
    }
    if (val && (Number.isNaN(val.lonDeg) || !Number.isFinite(val.lonDeg))) {
      throw new Error(`Override for ${key}: lonDeg must be a finite number (0-360).`);
    }
  }
}

/**
 * Generate snapshot with overrides applied.
 * Takes base snapshot and applies planet longitude overrides, then recalculates dependent fields.
 */
export function generateSnapshotWithOverrides(
  baseSnapshot: EphemerisSnapshot,
  overrides: SandboxOverrides
): EphemerisSnapshot {
  validateSandboxOverrides(overrides);

  const overriddenPlanets = baseSnapshot.planets.map(p => ({ ...p }));
  const positions: Record<string, number> = {};

  for (const planet of overriddenPlanets) {
    const override = overrides.planets[planet.name as PlanetKey];
    if (override) {
      let lonDeg = Number(override.lonDeg);
      if (!Number.isFinite(lonDeg)) lonDeg = 0;
      while (lonDeg < 0) lonDeg += 360;
      while (lonDeg >= 360) lonDeg -= 360;
      planet.lon = lonDeg;
    }
    positions[planet.name] = planet.lon;
  }
  
  // Recalculate aspects using overridden positions
  const aspects = calcAspects(positions).map(a => ({
    a: a.p1,
    b: a.p2,
    type: a.type,
    orb: a.orb
  }));
  
  // Recalculate dominant elements
  const dominantElements = calcDominantElements(positions);
  
  // Recalculate moon phase (if Sun or Moon were overridden)
  let moonPhase = baseSnapshot.moonPhase;
  const sunLon = positions.sun;
  const moonLon = positions.moon;
  if (sunLon !== undefined && moonLon !== undefined) {
    moonPhase = calcMoonPhase(sunLon, moonLon);
  }
  
  // Houses remain from base snapshot (not recalculated in 4A)
  
  return {
    ...baseSnapshot,
    planets: overriddenPlanets,
    aspects,
    moonPhase,
    dominantElements
  };
}

/**
 * Generate hash for birth data.
 */
export function hashBirth(birth: SandboxBirth): string {
  const crypto = require('crypto') as typeof import('crypto');
  const str = `${birth.date}|${birth.time}|${birth.lat}|${birth.lon}|${birth.tz || 'UTC'}|${birth.houseSystem || 'placidus'}`;
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Generate hash for overrides.
 */
export function hashOverrides(overrides: SandboxOverrides): string {
  const crypto = require('crypto') as typeof import('crypto');
  // Sort planet keys for deterministic hashing
  const planetEntries = Object.entries(overrides.planets || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.lonDeg.toFixed(1)}`);
  const angleEntries: string[] = [];
  if (overrides.angles?.ascDeg !== undefined) angleEntries.push(`asc:${overrides.angles.ascDeg.toFixed(1)}`);
  if (overrides.angles?.mcDeg !== undefined) angleEntries.push(`mc:${overrides.angles.mcDeg.toFixed(1)}`);
  const str = [...planetEntries, ...angleEntries].join('|');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}
