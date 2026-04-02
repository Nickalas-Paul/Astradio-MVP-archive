/**
 * Phase 4A / 8H — Sandbox snapshot with overrides.
 * Produces a REAL EphemerisSnapshot from birth data + planet overrides.
 * Recalculates aspects (Phase 8H aspect engine) and dominantElements deterministically.
 */

import type { EphemerisSnapshot, SandboxBirth, SandboxOverrides, PlanetKey } from '../contracts';
import { BODY_DISPLAY_ORDER } from '../canonical-bodies';
import { computeAspects, toSnapshotAspects } from '../aspect-engine';
import { serializeNumberForHash } from './sandbox-determinism';

/** Canonical body order for snapshot derivation. */
const PLANET_ORDER: PlanetKey[] = [...BODY_DISPLAY_ORDER] as PlanetKey[];

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
  const hasPlanetOverrides = Object.keys(overrides.planets || {}).length > 0;
  // Canonical no-op: if no overrides are present, preserve the chart-snapshot payload
  // exactly to avoid semantic drift between snapshot sources.
  if (!hasPlanetOverrides) {
    return {
      ...baseSnapshot,
      planets: baseSnapshot.planets.map((p) => ({ ...p })),
      houses: [...baseSnapshot.houses] as EphemerisSnapshot['houses'],
      aspects: baseSnapshot.aspects.map((a) => ({ ...a })),
      dominantElements: { ...baseSnapshot.dominantElements },
    };
  }

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
  
  // Recalculate aspects using Phase 8H aspect engine (dynamics, strength, exactness, priorityBase)
  const aspects = toSnapshotAspects(computeAspects(positions));
  
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
  const payload = {
    date: birth.date,
    time: birth.time,
    lat: birth.lat,
    lon: birth.lon,
    tz: birth.tz ?? 'UTC',
    houseSystem: birth.houseSystem ?? 'placidus',
  };
  const str = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Generate hash for overrides.
 */
export function hashOverrides(overrides: SandboxOverrides): string {
  const crypto = require('crypto') as typeof import('crypto');
  const planets = overrides.planets || {};
  const sortedKeys = Object.keys(planets).sort((a, b) => a.localeCompare(b));
  const planetObj: Record<string, { lonDeg: string }> = {};
  for (const k of sortedKeys) {
    const v = planets[k as PlanetKey];
    if (v && typeof v.lonDeg === 'number' && Number.isFinite(v.lonDeg)) {
      planetObj[k] = { lonDeg: serializeNumberForHash(v.lonDeg) };
    }
  }
  const angles = overrides.angles;
  const anglePart: Record<string, string> = {};
  if (angles?.ascDeg !== undefined && typeof angles.ascDeg === 'number' && Number.isFinite(angles.ascDeg)) {
    anglePart.ascDeg = serializeNumberForHash(angles.ascDeg);
  }
  if (angles?.mcDeg !== undefined && typeof angles.mcDeg === 'number' && Number.isFinite(angles.mcDeg)) {
    anglePart.mcDeg = serializeNumberForHash(angles.mcDeg);
  }
  const payload = { planets: planetObj, angles: anglePart };
  const str = JSON.stringify(payload, (_k, v) => v);
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}
