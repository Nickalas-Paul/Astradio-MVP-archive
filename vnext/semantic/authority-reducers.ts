/**
 * Internal reducers for SemanticAuthority only — not a parallel semantic API.
 */
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { MechanicalControlSignals } from '../canonical/canonical-report-object';
import { astroSummaryFromSnapshot } from '../explainer/astro-summary-from-snapshot';

export type ElementKey = 'fire' | 'earth' | 'air' | 'water';

export interface ChartStructuralSignals {
  primaryElement: ElementKey;
  secondaryElement?: ElementKey;
  elementalBalance: Record<ElementKey, number>;
  modalityBalance: { cardinal: number; fixed: number; mutable: number };
  tensionIndex: number;
  resolutionIndex: number;
  motionProfileStr: string;
  gravityProfileStr: string;
  tonalPolarity: 'bright' | 'balanced' | 'dark';
  dominantPlanets: string[];
  stelliumClusters: Array<{ type: 'sign' | 'house'; key: string; strength: number }>;
  angularEmphasis: { first: boolean; fourth: boolean; seventh: boolean; tenth: boolean };
  luminaryWeight: 'sun' | 'moon' | 'balanced';
  aspectSignature: { trineHeavy: boolean; squareHeavy: boolean; oppositionHeavy: boolean };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function dominantElementFromBlend(blend: Record<ElementKey, number>): ElementKey {
  let best: ElementKey = 'fire';
  let bestVal = blend.fire;
  if (blend.earth >= bestVal) {
    best = 'earth';
    bestVal = blend.earth;
  }
  if (blend.air >= bestVal) {
    best = 'air';
    bestVal = blend.air;
  }
  if (blend.water >= bestVal) {
    best = 'water';
  }
  return best;
}

function secondaryElementFromBlend(blend: Record<ElementKey, number>, primary: ElementKey): ElementKey | undefined {
  const entries: Array<[ElementKey, number]> = [
    ['fire', blend.fire],
    ['earth', blend.earth],
    ['air', blend.air],
    ['water', blend.water],
  ];
  const sorted = entries.filter(([el]) => el !== primary).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  if (!top || top[1] <= 0) return undefined;
  return top[0];
}

function tonalPolarityFromIndices(brightnessIndex: number): ChartStructuralSignals['tonalPolarity'] {
  if (brightnessIndex <= 0.35) return 'dark';
  if (brightnessIndex >= 0.65) return 'bright';
  return 'balanced';
}

function modalityFromSummary(modality: { cardinal: number; fixed: number; mutable: number }) {
  const sum = modality.cardinal + modality.fixed + modality.mutable || 1;
  return {
    cardinal: modality.cardinal / sum,
    fixed: modality.fixed / sum,
    mutable: modality.mutable / sum,
  };
}

function angularEmphasisFromSnapshot(snapshot: EphemerisSnapshot) {
  const houses = snapshot.houses;
  if (!houses || houses.length < 10) {
    return { first: false, fourth: false, seventh: false, tenth: false };
  }
  const totalPlanets = (snapshot.planets ?? []).length || 1;
  const orb = 15;
  const near = (cuspDeg: number): number => {
    const cusp = ((cuspDeg % 360) + 360) % 360;
    let count = 0;
    for (const p of snapshot.planets ?? []) {
      const lon = ((p.lon % 360) + 360) % 360;
      let delta = Math.abs(lon - cusp);
      if (delta > 180) delta = 360 - delta;
      if (delta <= orb) count++;
    }
    return count;
  };
  const firstCount = near(houses[0]);
  const fourthCount = near(houses[3]);
  const seventhCount = near(houses[6]);
  const tenthCount = near(houses[9]);
  const frac = (n: number) => n / totalPlanets;
  return {
    first: firstCount >= 2 && frac(firstCount) >= 0.2,
    fourth: fourthCount >= 2 && frac(fourthCount) >= 0.2,
    seventh: seventhCount >= 2 && frac(seventhCount) >= 0.2,
    tenth: tenthCount >= 2 && frac(tenthCount) >= 0.2,
  };
}

function aspectSignatureFromSnapshot(snapshot: EphemerisSnapshot) {
  const aspects = snapshot.aspects ?? [];
  if (!aspects.length) {
    return { trineHeavy: false, squareHeavy: false, oppositionHeavy: false };
  }
  let trines = 0;
  let squares = 0;
  let opps = 0;
  for (const a of aspects) {
    if (a.type === 'trine') trines++;
    else if (a.type === 'square') squares++;
    else if (a.type === 'opposition') opps++;
  }
  const totalMajor = trines + squares + opps || 1;
  return {
    trineHeavy: trines >= 2 && trines / totalMajor >= 0.4,
    squareHeavy: squares >= 2 && squares / totalMajor >= 0.4,
    oppositionHeavy: opps >= 2 && opps / totalMajor >= 0.4,
  };
}

function luminaryWeightFromPlanets(dominantPlanets: string[]): ChartStructuralSignals['luminaryWeight'] {
  const top = dominantPlanets.slice(0, 3).map((p) => p.toLowerCase());
  const hasSun = top.includes('sun');
  const hasMoon = top.includes('moon');
  if (hasSun && !hasMoon) return 'sun';
  if (hasMoon && !hasSun) return 'moon';
  return 'balanced';
}

function stelliumClustersFromSnapshot(snapshot: EphemerisSnapshot) {
  const planets = snapshot.planets ?? [];
  if (!planets.length) return [];
  const houses = snapshot.houses ?? [];
  if (!houses.length) return [];
  const countByHouse: number[] = Array.from({ length: 12 }, () => 0);
  for (const p of planets) {
    const lon = ((p.lon % 360) + 360) % 360;
    let bestHouse = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < Math.min(12, houses.length); i++) {
      const cusp = ((houses[i] % 360) + 360) % 360;
      let delta = Math.abs(lon - cusp);
      if (delta > 180) delta = 360 - delta;
      if (delta < bestDelta) {
        bestDelta = delta;
        bestHouse = i;
      }
    }
    countByHouse[bestHouse]++;
  }
  const totalPlanets = planets.length || 1;
  const clusters: Array<{ type: 'sign' | 'house'; key: string; strength: number }> = [];
  for (let i = 0; i < 12; i++) {
    const count = countByHouse[i];
    if (count >= 3) {
      clusters.push({ type: 'house', key: String(i + 1), strength: clamp01(count / totalPlanets) });
    }
  }
  return clusters;
}

function motionProfileLabel(m: { motion: number; flow: number }): string {
  const { motion, flow } = m;
  if (motion >= 0.7 && flow >= 0.5) return 'surging';
  if (motion >= 0.6 && flow < 0.5) return 'restless';
  if (motion <= 0.35 && flow >= 0.5) return 'quiet_flow';
  if (motion <= 0.35 && flow < 0.5) return 'inward_consolidation';
  return 'steady';
}

function gravityProfileLabel(m: { gravity: number; shimmer: number }): string {
  const { gravity, shimmer } = m;
  if (gravity >= 0.7 && shimmer <= 0.4) return 'anchored';
  if (gravity >= 0.55 && shimmer > 0.4) return 'weighted_with_spark';
  if (gravity <= 0.35 && shimmer >= 0.6) return 'floating';
  if (gravity <= 0.4) return 'light';
  return 'balanced';
}

export function reduceChartStructuralSignals(
  snapshot: EphemerisSnapshot,
  featureVec: FeatureVec,
  mechanical: MechanicalControlSignals
): ChartStructuralSignals {
  const astroSummary = astroSummaryFromSnapshot(snapshot, featureVec);
  const elements = astroSummary.elements;
  const elementalBalance: Record<ElementKey, number> = {
    fire: elements.fire,
    earth: elements.earth,
    air: elements.air,
    water: elements.water,
  };
  const primaryElement = dominantElementFromBlend(elementalBalance);
  const secondaryElement = secondaryElementFromBlend(elementalBalance, primaryElement);
  const modalityBalance = modalityFromSummary(astroSummary.modality);
  const tensionIndex = clamp01(featureVec[32] ?? 0);
  const shimmer = clamp01(mechanical.shimmer);
  const brightnessIndex = clamp01(0.55 * (1 - tensionIndex) + 0.45 * shimmer);
  const gravity = clamp01(mechanical.gravity);
  const resolutionIndex = clamp01(0.6 * gravity + 0.4 * (1 - tensionIndex * 0.7));
  const tonalPolarity = tonalPolarityFromIndices(brightnessIndex);
  const motionProfileStr = motionProfileLabel({
    motion: mechanical.motion,
    flow: mechanical.flow,
  });
  const gravityProfileStr = gravityProfileLabel({
    gravity: mechanical.gravity,
    shimmer: mechanical.shimmer,
  });
  const dominantPlanets = astroSummary.dominant_planets ?? [];
  return {
    primaryElement,
    secondaryElement,
    elementalBalance,
    modalityBalance,
    tensionIndex,
    resolutionIndex,
    motionProfileStr,
    gravityProfileStr,
    tonalPolarity,
    dominantPlanets,
    stelliumClusters: stelliumClustersFromSnapshot(snapshot),
    angularEmphasis: angularEmphasisFromSnapshot(snapshot),
    luminaryWeight: luminaryWeightFromPlanets(dominantPlanets),
    aspectSignature: aspectSignatureFromSnapshot(snapshot),
  };
}
