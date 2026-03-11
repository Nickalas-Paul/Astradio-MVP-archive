import type { EphemerisSnapshot, FeatureVec } from "../contracts";
import type { AstroGuidance, MotionProfile } from "../astro/guidance";
import type { RelationalChartContext } from "../report-context";
import { astroSummaryFromSnapshot } from "../explainer/astro-summary-from-snapshot";

export type ElementKey = "fire" | "earth" | "air" | "water";

export interface ChartSemanticProfile {
  primaryElement: ElementKey;
  secondaryElement?: ElementKey;

  elementalBalance: Record<ElementKey, number>;
  modalityBalance: { cardinal: number; fixed: number; mutable: number };

  tensionIndex: number;
  resolutionIndex: number;

  motionProfile: string;
  gravityProfile: string;

  tonalPolarity: "bright" | "balanced" | "dark";
  energySignature: string;

  dominantPlanets: string[];
  stelliumClusters: Array<{ type: "sign" | "house"; key: string; strength: number }>;
  angularEmphasis: {
    first: boolean;
    fourth: boolean;
    seventh: boolean;
    tenth: boolean;
  };

  luminaryWeight: "sun" | "moon" | "balanced";
  aspectSignature: {
    trineHeavy: boolean;
    squareHeavy: boolean;
    oppositionHeavy: boolean;
  };
}

export interface CrossSurfaceToneHints {
  text: {
    emphasizeTension: "low" | "medium" | "high";
    avoidShadowLanguage: boolean;
    emphasizeRelationalMirroring: boolean;
    emphasizeWaterLanguage: boolean;
  };
  audio: {
    harmonicTension: "low" | "medium" | "high";
    avoidDarkDefaults: boolean;
    preferFluidTextures: boolean;
    preferCallAndResponse: boolean;
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function dominantElementFromBlend(blend: Record<ElementKey, number>): ElementKey {
  let best: ElementKey = "fire";
  let bestVal = blend.fire;
  if (blend.earth >= bestVal) {
    best = "earth";
    bestVal = blend.earth;
  }
  if (blend.air >= bestVal) {
    best = "air";
    bestVal = blend.air;
  }
  if (blend.water >= bestVal) {
    best = "water";
  }
  return best;
}

function secondaryElementFromBlend(
  blend: Record<ElementKey, number>,
  primary: ElementKey
): ElementKey | undefined {
  const entries: Array<[ElementKey, number]> = [
    ["fire", blend.fire],
    ["earth", blend.earth],
    ["air", blend.air],
    ["water", blend.water],
  ];
  const sorted = entries
    .filter(([el]) => el !== primary)
    .sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  if (!top || top[1] <= 0) return undefined;
  return top[0];
}

function tonalPolarityFromIndices(brightnessIndex: number): ChartSemanticProfile["tonalPolarity"] {
  if (brightnessIndex <= 0.35) return "dark";
  if (brightnessIndex >= 0.65) return "bright";
  return "balanced";
}

function modalityFromSummary(modality: {
  cardinal: number;
  fixed: number;
  mutable: number;
}): { cardinal: number; fixed: number; mutable: number } {
  const sum = modality.cardinal + modality.fixed + modality.mutable || 1;
  return {
    cardinal: modality.cardinal / sum,
    fixed: modality.fixed / sum,
    mutable: modality.mutable / sum,
  };
}

function angularEmphasisFromSnapshot(snapshot: EphemerisSnapshot): {
  first: boolean;
  fourth: boolean;
  seventh: boolean;
  tenth: boolean;
} {
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
  const first = firstCount >= 2 && frac(firstCount) >= 0.2;
  const fourth = fourthCount >= 2 && frac(fourthCount) >= 0.2;
  const seventh = seventhCount >= 2 && frac(seventhCount) >= 0.2;
  const tenth = tenthCount >= 2 && frac(tenthCount) >= 0.2;
  return { first, fourth, seventh, tenth };
}

function aspectSignatureFromSnapshot(snapshot: EphemerisSnapshot): ChartSemanticProfile["aspectSignature"] {
  const aspects = snapshot.aspects ?? [];
  if (!aspects.length) {
    return { trineHeavy: false, squareHeavy: false, oppositionHeavy: false };
  }
  let trines = 0;
  let squares = 0;
  let opps = 0;
  for (const a of aspects) {
    if (a.type === "trine") trines++;
    else if (a.type === "square") squares++;
    else if (a.type === "opposition") opps++;
  }
  const totalMajor = trines + squares + opps || 1;
  const trineHeavy = trines >= 2 && trines / totalMajor >= 0.4;
  const squareHeavy = squares >= 2 && squares / totalMajor >= 0.4;
  const oppositionHeavy = opps >= 2 && opps / totalMajor >= 0.4;
  return { trineHeavy, squareHeavy, oppositionHeavy };
}

function luminaryWeightFromPlanets(dominantPlanets: string[]): ChartSemanticProfile["luminaryWeight"] {
  const top = dominantPlanets.slice(0, 3).map((p) => p.toLowerCase());
  const hasSun = top.includes("sun");
  const hasMoon = top.includes("moon");
  if (hasSun && !hasMoon) return "sun";
  if (hasMoon && !hasSun) return "moon";
  return "balanced";
}

function stelliumClustersFromSnapshot(snapshot: EphemerisSnapshot): ChartSemanticProfile["stelliumClusters"] {
  const planets = snapshot.planets ?? [];
  if (!planets.length) return [];
  const houses = snapshot.houses ?? [];
  if (!houses.length) return [];

  const countByHouse: number[] = Array.from({ length: 12 }, () => 0);
  // Approximate house occupancy using house cusps; reuse same simple mapping as text engine does conceptually.
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
  const clusters: Array<{ type: "sign" | "house"; key: string; strength: number }> = [];
  for (let i = 0; i < 12; i++) {
    const count = countByHouse[i];
    if (count >= 3) {
      const strength = clamp01(count / totalPlanets);
      clusters.push({
        type: "house",
        key: String(i + 1),
        strength,
      });
    }
  }
  return clusters;
}

function motionProfileLabel(motionProfile: MotionProfile): string {
  const { motion, flow } = motionProfile;
  if (motion >= 0.7 && flow >= 0.5) return "surging";
  if (motion >= 0.6 && flow < 0.5) return "restless";
  if (motion <= 0.35 && flow >= 0.5) return "quiet_flow";
  if (motion <= 0.35 && flow < 0.5) return "inward_consolidation";
  return "steady";
}

function gravityProfileLabel(motionProfile: MotionProfile): string {
  const { gravity, shimmer } = motionProfile;
  if (gravity >= 0.7 && shimmer <= 0.4) return "anchored";
  if (gravity >= 0.55 && shimmer > 0.4) return "weighted_with_spark";
  if (gravity <= 0.35 && shimmer >= 0.6) return "floating";
  if (gravity <= 0.4) return "light";
  return "balanced";
}

export function buildChartSemanticProfile(params: {
  snapshot: EphemerisSnapshot;
  featureVec: FeatureVec;
  guidance: AstroGuidance & { motionProfile: MotionProfile };
  relationalContext?: RelationalChartContext;
}): ChartSemanticProfile {
  const { snapshot, featureVec, guidance } = params;

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

  const modality = modalityFromSummary(astroSummary.modality);

  const tensionIndex = clamp01(featureVec[32] ?? 0);
  const clusterDensity = clamp01(featureVec[33] ?? 0);

  const shimmer = clamp01(guidance.motionProfile.shimmer);
  const brightnessIndex = clamp01(0.55 * (1 - tensionIndex) + 0.45 * shimmer);

  const gravity = clamp01(guidance.motionProfile.gravity);
  const resolutionIndex = clamp01(0.6 * gravity + 0.4 * (1 - tensionIndex * 0.7));

  const tonalPolarity = tonalPolarityFromIndices(brightnessIndex);

  const motionProfileStr = motionProfileLabel(guidance.motionProfile);
  const gravityProfileStr = gravityProfileLabel(guidance.motionProfile);

  const dominantPlanets = astroSummary.dominant_planets ?? [];
  const stelliumClusters = stelliumClustersFromSnapshot(snapshot);
  const angularEmphasis = angularEmphasisFromSnapshot(snapshot);
  const aspectSignature = aspectSignatureFromSnapshot(snapshot);
  const luminaryWeight = luminaryWeightFromPlanets(dominantPlanets);

  const energySignature = [
    primaryElement,
    tonalPolarity,
    motionProfileStr,
    gravityProfileStr,
  ].join(":");

  return {
    primaryElement,
    secondaryElement,
    elementalBalance,
    modalityBalance: modality,
    tensionIndex,
    resolutionIndex,
    motionProfile: motionProfileStr,
    gravityProfile: gravityProfileStr,
    tonalPolarity,
    energySignature,
    dominantPlanets,
    stelliumClusters,
    angularEmphasis,
    luminaryWeight,
    aspectSignature,
  };
}

export function deriveCrossSurfaceToneHints(profile: ChartSemanticProfile): CrossSurfaceToneHints {
  const tension =
    profile.tensionIndex >= 0.7 ? "high" : profile.tensionIndex >= 0.4 ? "medium" : "low";

  const emphasizeWaterLanguage = profile.primaryElement === "water";
  const emphasizeRelationalMirroring = profile.angularEmphasis.seventh === true;

  const avoidShadowLanguage = profile.tonalPolarity === "bright";
  const avoidDarkDefaults = profile.tonalPolarity === "bright";

  const preferFluidTextures =
    profile.primaryElement === "water" || profile.motionProfile === "quiet_flow";

  const preferCallAndResponse = profile.angularEmphasis.seventh === true;

  return {
    text: {
      emphasizeTension: tension,
      avoidShadowLanguage,
      emphasizeRelationalMirroring,
      emphasizeWaterLanguage,
    },
    audio: {
      harmonicTension: tension,
      avoidDarkDefaults,
      preferFluidTextures,
      preferCallAndResponse,
    },
  };
}

