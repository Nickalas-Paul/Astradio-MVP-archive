/**
 * Prominence filter: select a small set of chart factors for 1:1:1 correspondence (astro → psych → music).
 * Deterministic, no randomness. Used by ExplainSpec engine only.
 */

import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import { astroSummaryFromSnapshot } from './astro-summary-from-snapshot';

export type PlanetName = string; // Capitalized e.g. "Sun", "Moon"

export type Factor =
  | {
      kind: 'planet';
      planet: PlanetName;
      weight: number;
      reasons: string[];
    }
  | {
      kind: 'aspect';
      a: PlanetName;
      b: PlanetName;
      aspect: 'conj' | 'opp' | 'square' | 'trine' | 'sextile';
      orbDeg?: number;
      weight: number;
      reasons: string[];
    }
  | {
      kind: 'angle';
      angle: 'ASC' | 'MC' | 'IC' | 'DSC';
      ruler?: PlanetName;
      weight: number;
      reasons: string[];
    };

export type ProminenceOptions = {
  maxPlanets?: number;
  maxAspects?: number;
  maxAngles?: number;
};

const DEFAULT_OPTIONS: Required<ProminenceOptions> = {
  maxPlanets: 3,
  maxAspects: 4,
  maxAngles: 2
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const LUMINARIES = new Set(['Sun', 'Moon']);
const ASPECT_TYPE_MAP: Record<string, 'conj' | 'opp' | 'square' | 'trine' | 'sextile'> = {
  conjunction: 'conj',
  opposition: 'opp',
  square: 'square',
  trine: 'trine',
  sextile: 'sextile'
};
const ASPECT_BASE_WEIGHT: Record<string, number> = {
  conj: 4,
  opp: 3.5,
  square: 3.5,
  trine: 3,
  sextile: 2
};

/**
 * Select prominent factors (planets, aspects, angles) deterministically.
 */
export function selectProminentFactors(
  snapshot: EphemerisSnapshot,
  featureVec: FeatureVec,
  options?: ProminenceOptions
): Factor[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const factors: Factor[] = [];
  const astro = astroSummaryFromSnapshot(snapshot, featureVec);

  // 1) Planets: up to maxPlanets (include luminaries if in dominant, then top dominant)
  const dominant = astro.dominant_planets ?? [];
  const planetSet = new Set<string>();
  for (const p of dominant) {
    const name = cap(p);
    if (planetSet.has(name)) continue;
    if (planetSet.size >= opts.maxPlanets) break;
    const isLuminary = LUMINARIES.has(name);
    const reasons: string[] = isLuminary ? ['luminary in dominant set'] : ['dominant planet'];
    factors.push({
      kind: 'planet',
      planet: name,
      weight: isLuminary ? 10 : 8 - planetSet.size,
      reasons
    });
    planetSet.add(name);
  }

  // 2) Angles: 1–2 if houses available (ASC = house 1, MC = house 10, IC = 4, DSC = 7)
  const houses = snapshot.houses;
  if (houses && houses.length >= 10 && opts.maxAngles > 0) {
    const angleCandidates: Array<{ angle: 'ASC' | 'MC' | 'IC' | 'DSC'; idx: number }> = [
      { angle: 'ASC', idx: 0 },
      { angle: 'MC', idx: 9 },
      { angle: 'IC', idx: 3 },
      { angle: 'DSC', idx: 6 }
    ];
    for (let i = 0; i < angleCandidates.length && factors.filter((f) => f.kind === 'angle').length < opts.maxAngles; i++) {
      const { angle, idx } = angleCandidates[i];
      factors.push({
        kind: 'angle',
        angle,
        weight: 5 - i * 0.5,
        reasons: [`angle ${angle} from house cusp`]
      });
    }
  }

  // 3) Aspects: from snapshot.aspects, score and take top N
  const aspects = snapshot.aspects ?? [];
  const aspectFactors: Factor[] = [];
  for (const asp of aspects) {
    const typeKey = ASPECT_TYPE_MAP[asp.type];
    if (!typeKey) continue;
    const a = cap(asp.bodyA ?? (asp as { a?: string }).a ?? '');
    const b = cap(asp.bodyB ?? (asp as { b?: string }).b ?? '');
    let weight = ASPECT_BASE_WEIGHT[typeKey] ?? 2;
    const reasons: string[] = [`${asp.type}`];
    if (LUMINARIES.has(a) || LUMINARIES.has(b)) {
      weight += 1.5;
      reasons.push('involves luminary');
    }
    if (asp.orb !== undefined && asp.orb < 5) {
      weight += 0.5;
      reasons.push('tight orb');
    }
    aspectFactors.push({
      kind: 'aspect',
      a,
      b,
      aspect: typeKey,
      orbDeg: asp.orb,
      weight,
      reasons
    });
  }
  aspectFactors.sort((x, y) => y.weight - x.weight);
  for (let i = 0; i < aspectFactors.length && factors.filter((f) => f.kind === 'aspect').length < opts.maxAspects; i++) {
    factors.push(aspectFactors[i]);
  }

  return factors;
}
