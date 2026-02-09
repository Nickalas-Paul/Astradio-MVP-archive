/**
 * Build AstroSummary from the same EphemerisSnapshot used for encodeFeatures().
 * Deterministic: no Date.now, Math.random, or timestamps in logic.
 */

import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { AstroSummary } from './contracts';

const PLANET_ORDER = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
/** Inner planets get higher base weight (explainable, stable ordering). */
const PRIORITY_WEIGHT: Record<string, number> = {
  sun: 10, moon: 9, mercury: 8, venus: 7, mars: 6,
  jupiter: 5, saturn: 4, uranus: 3, neptune: 2, pluto: 1
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Capitalize for mapping table keys (e.g. "Mars"). */
function planetDisplayName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * Deterministic dominant planets: 1–3 planets by score (priority weight + aspect involvement).
 * Tie-breaker: lowest longitude (stable for same snapshot).
 */
function dominantPlanetsFromSnapshot(snapshot: EphemerisSnapshot): string[] {
  const planets = snapshot.planets ?? [];
  if (planets.length === 0) return [];

  const aspectCount: Record<string, number> = {};
  for (const p of planets) {
    aspectCount[p.name] = 0;
  }
  for (const asp of snapshot.aspects ?? []) {
    if (asp.a && aspectCount[asp.a] !== undefined) aspectCount[asp.a]++;
    if (asp.b && asp.b !== asp.a && aspectCount[asp.b] !== undefined) aspectCount[asp.b]++;
  }

  const scored = planets.map((p) => {
    const priority = PRIORITY_WEIGHT[p.name] ?? 0;
    const involvement = (aspectCount[p.name] ?? 0) * 2;
    const lon = ((p.lon % 360) + 360) % 360;
    return {
      name: p.name,
      score: priority + involvement,
      lon
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.lon - b.lon;
  });

  const top = scored.slice(0, 3).map((s) => planetDisplayName(s.name));
  return top;
}

/**
 * Build AstroSummary from snapshot and optional featureVec.
 * - elements: featureVec 27–30 if provided, else snapshot.dominantElements; normalized sum ≈ 1.
 * - modality: use payloadModality when snapshot has no modality (existing behavior).
 * - dominant_planets: deterministic 1–3 from snapshot.
 */
export function astroSummaryFromSnapshot(
  snapshot: EphemerisSnapshot,
  featureVec?: FeatureVec,
  payloadModality?: string
): AstroSummary {
  let fire: number;
  let earth: number;
  let air: number;
  let water: number;

  if (featureVec && featureVec.length >= 31) {
    fire = clamp01(featureVec[27] ?? 0);
    earth = clamp01(featureVec[28] ?? 0);
    air = clamp01(featureVec[29] ?? 0);
    water = clamp01(featureVec[30] ?? 0);
  } else if (snapshot.dominantElements) {
    fire = clamp01(snapshot.dominantElements.fire ?? 0);
    earth = clamp01(snapshot.dominantElements.earth ?? 0);
    air = clamp01(snapshot.dominantElements.air ?? 0);
    water = clamp01(snapshot.dominantElements.water ?? 0);
  } else {
    fire = earth = air = water = 0.25;
  }

  const sum = fire + earth + air + water || 1;
  const elements = {
    fire: fire / sum,
    earth: earth / sum,
    air: air / sum,
    water: water / sum
  };

  const modality = (payloadModality === 'cardinal' || payloadModality === 'fixed' || payloadModality === 'mutable')
    ? payloadModality
    : 'mutable';
  const modalityObj = {
    cardinal: modality === 'cardinal' ? 0.6 : 0.1,
    fixed: modality === 'fixed' ? 0.6 : 0.1,
    mutable: modality === 'mutable' ? 0.6 : 0.1
  };

  const dominant_planets = dominantPlanetsFromSnapshot(snapshot);

  return {
    elements,
    dominant_planets,
    modality: modalityObj,
    ts: snapshot.ts ?? ''
  };
}
