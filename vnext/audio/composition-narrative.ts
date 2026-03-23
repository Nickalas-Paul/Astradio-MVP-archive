import type { EphemerisSnapshot, FeatureVec, Plan } from "../contracts";
import type { ControlSurfacePayload } from "../explainer/contracts";
import type { ArchitectureOutput } from "../core/architecture-engine";
import { astroSummaryFromSnapshot } from "../explainer/astro-summary-from-snapshot";
import type { SemanticCore } from "../semantic/semantic-core";
import {
  deriveCrossSurfaceToneHintsFromSemanticCore,
  extractNarrativeScalarsFromSemanticCore,
  type CrossSurfaceToneHints,
} from "../projection/audio-projection";

export type PrimaryElement = "fire" | "earth" | "air" | "water";

export type ArcShape =
  | "rise"
  | "fall"
  | "bloom"
  | "tension_release"
  | "cyclic"
  | "surge_then_resolve";

export type EnergyCurve = "build" | "fall" | "pulse" | "stable";

export type PeakWindow = "early" | "mid" | "late";

export type EndingStyle =
  | "resolved"
  | "suspended"
  | "dissipating"
  | "triumphant"
  | "open";

export type DensityProfile = "sparse_to_full" | "full_to_sparse" | "stable";

export type TonalPolarity = "bright" | "balanced" | "dark";

export type LuminaryDominance = "sun" | "moon" | "balanced";

export interface StelliumSignature {
  hasCluster: boolean;
  /** 0-1 heuristic strength derived from existing cluster density feature. */
  strength: number;
  /** Element tint for the cluster, when clear. */
  element?: PrimaryElement;
}

export interface AngularDominance {
  first: boolean;
  fourth: boolean;
  seventh: boolean;
  tenth: boolean;
}

export interface PlanetarySignatureFlags {
  sun: boolean;
  moon: boolean;
  mars: boolean;
  venus: boolean;
  jupiter: boolean;
  saturn: boolean;
  pluto: boolean;
}

export interface AspectSignatureFlags {
  trineHeavy: boolean;
  squareHeavy: boolean;
  oppositionHeavy: boolean;
}

export interface CompositionNarrativePlan {
  primaryElement: PrimaryElement;
  secondaryElement?: PrimaryElement;

  modalityBalance: {
    cardinal: number;
    fixed: number;
    mutable: number;
  };

  brightnessIndex: number;
  tensionIndex: number;
  resolutionIndex: number;

  arcShape: ArcShape;
  energyCurve: EnergyCurve;
  peakWindow: PeakWindow;

  endingStyle: EndingStyle;

  rhythmicDrive: number;
  densityProfile: DensityProfile;

  tonalPolarity: TonalPolarity;

  /** Phase 4: chart-identity amplification hooks (deterministic, derived from snapshot/guidance). */
  stellium?: StelliumSignature;
  angularDominance?: AngularDominance;
  luminaryDominance?: LuminaryDominance;
  planetarySignatures?: PlanetarySignatureFlags;
  aspectSignatures?: AspectSignatureFlags;
  /** Canonical object hash whose SemanticCore drove this narrative. */
  semantic_source_object_hash: string;
  /** Phase 5: lightweight cross-surface tone hints applied to this narrative. */
  toneHints: CrossSurfaceToneHints;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function normalizedDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

function dominantElementFromBlend(blend: {
  fire: number;
  earth: number;
  air: number;
  water: number;
}): PrimaryElement {
  let best: PrimaryElement = "fire";
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
  blend: { fire: number; earth: number; air: number; water: number },
  primary: PrimaryElement
): PrimaryElement | undefined {
  const entries: Array<[PrimaryElement, number]> = [
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

function modalityBalanceFromLabel(label: string | undefined): {
  cardinal: number;
  fixed: number;
  mutable: number;
} {
  const base = { cardinal: 0.33, fixed: 0.33, mutable: 0.34 };
  const m = (label || "").toLowerCase();
  if (m === "cardinal") {
    return { cardinal: 0.6, fixed: 0.2, mutable: 0.2 };
  }
  if (m === "fixed") {
    return { cardinal: 0.2, fixed: 0.6, mutable: 0.2 };
  }
  if (m === "mutable") {
    return { cardinal: 0.25, fixed: 0.25, mutable: 0.5 };
  }
  return base;
}

function tonalPolarityFromBrightness(brightnessIndex: number): TonalPolarity {
  if (brightnessIndex <= 0.35) return "dark";
  if (brightnessIndex >= 0.65) return "bright";
  return "balanced";
}

function arcShapeFromGuidance(params: {
  arcBias: number;
  motion: number;
  flow: number;
  tensionIndex: number;
}): ArcShape {
  const { arcBias, motion, flow, tensionIndex } = params;
  if (Math.abs(arcBias) < 0.15) {
    if (flow > 0.6 && tensionIndex > 0.4) return "tension_release";
    return "cyclic";
  }
  if (arcBias > 0.25) {
    if (tensionIndex > 0.6) return "surge_then_resolve";
    return motion > 0.6 ? "rise" : "bloom";
  }
  if (arcBias < -0.25) {
    return "fall";
  }
  if (tensionIndex > 0.55) return "tension_release";
  return "bloom";
}

function energyCurveFromMotion(motion: number, gravity: number): EnergyCurve {
  if (motion >= 0.65 && gravity <= 0.4) return "build";
  if (motion >= 0.55 && gravity >= 0.45) return "pulse";
  if (motion <= 0.35 && gravity >= 0.5) return "fall";
  return "stable";
}

function peakWindowFromArcBias(arcBias: number): PeakWindow {
  if (arcBias <= -0.25) return "early";
  if (arcBias >= 0.25) return "late";
  return "mid";
}

function endingStyleFromChart(params: {
  primaryElement: PrimaryElement;
  tonalPolarity: TonalPolarity;
  gravity: number;
  flow: number;
  moonPhase: number;
  plutoDepth: number;
}): EndingStyle {
  const { primaryElement, tonalPolarity, gravity, flow, moonPhase, plutoDepth } =
    params;

  const deep = plutoDepth >= 0.6;
  const bright = tonalPolarity === "bright";
  const dark = tonalPolarity === "dark";

  if (primaryElement === "fire" && bright && gravity >= 0.45) {
    return "triumphant";
  }
  if (primaryElement === "earth" && gravity >= 0.6 && !dark) {
    return "resolved";
  }
  if (primaryElement === "water" && (flow >= 0.6 || moonPhase >= 0.6)) {
    return deep || dark ? "suspended" : "dissipating";
  }
  if (primaryElement === "air" && !bright && moonPhase <= 0.4) {
    return "open";
  }
  if (dark || deep) {
    return "suspended";
  }
  if (gravity >= 0.5) {
    return "resolved";
  }
  return "open";
}

function densityProfileFromFeatures(params: {
  densityBias: number;
  clusterDensity: number;
}): DensityProfile {
  const d = clamp01(0.5 + 0.25 * params.densityBias + 0.25 * params.clusterDensity);
  if (d <= 0.4) return "sparse_to_full";
  if (d >= 0.6) return "full_to_sparse";
  return "stable";
}

function rhythmicDriveFromMotion(params: {
  motion: number;
  aspectTension: number;
}): number {
  const base = clamp01(params.motion);
  const tensionBoost = clamp01(params.aspectTension);
  return clamp01(0.6 * base + 0.4 * tensionBoost);
}

function stelliumFromSnapshot(
  snapshot: EphemerisSnapshot,
  clusterDensity: number,
  primaryElement: PrimaryElement
): StelliumSignature | undefined {
  const strength = clamp01(clusterDensity);
  if (strength < 0.5) return undefined;
  const elementBlend = snapshot.dominantElements;
  let bestElement: PrimaryElement | undefined = primaryElement;
  if (elementBlend) {
    const entries: Array<[PrimaryElement, number]> = [
      ["fire", elementBlend.fire ?? 0],
      ["earth", elementBlend.earth ?? 0],
      ["air", elementBlend.air ?? 0],
      ["water", elementBlend.water ?? 0],
    ];
    entries.sort((a, b) => b[1] - a[1]);
    if (entries[0] && entries[0][1] >= 0.4) {
      bestElement = entries[0][0];
    }
  }
  return {
    hasCluster: true,
    strength,
    element: bestElement,
  };
}

function planetsNearCusp(
  snapshot: EphemerisSnapshot,
  cuspDeg: number,
  orbDeg: number
): number {
  const c = normalizedDeg(cuspDeg);
  const planets = snapshot.planets ?? [];
  let count = 0;
  for (const p of planets) {
    const lon = normalizedDeg(p.lon);
    let delta = Math.abs(lon - c);
    if (delta > 180) delta = 360 - delta;
    if (delta <= orbDeg) count++;
  }
  return count;
}

function angularDominanceFromSnapshot(snapshot: EphemerisSnapshot): AngularDominance | undefined {
  const houses = snapshot.houses;
  if (!houses || houses.length < 10) return undefined;
  const totalPlanets = (snapshot.planets ?? []).length || 1;
  const orb = 15;
  const firstCount = planetsNearCusp(snapshot, houses[0], orb);
  const fourthCount = planetsNearCusp(snapshot, houses[3], orb);
  const seventhCount = planetsNearCusp(snapshot, houses[6], orb);
  const tenthCount = planetsNearCusp(snapshot, houses[9], orb);
  const frac = (n: number) => n / totalPlanets;
  const first = firstCount >= 2 && frac(firstCount) >= 0.2;
  const fourth = fourthCount >= 2 && frac(fourthCount) >= 0.2;
  const seventh = seventhCount >= 2 && frac(seventhCount) >= 0.2;
  const tenth = tenthCount >= 2 && frac(tenthCount) >= 0.2;
  if (!first && !fourth && !seventh && !tenth) return undefined;
  return { first, fourth, seventh, tenth };
}

function luminaryDominanceFromSummary(
  dominantPlanets: string[]
): LuminaryDominance {
  const top = dominantPlanets.slice(0, 3).map((p) => p.toLowerCase());
  const hasSun = top.includes("sun");
  const hasMoon = top.includes("moon");
  if (hasSun && !hasMoon) return "sun";
  if (hasMoon && !hasSun) return "moon";
  return "balanced";
}

function planetarySignaturesFromSummary(
  dominantPlanets: string[]
): PlanetarySignatureFlags | undefined {
  if (!dominantPlanets || dominantPlanets.length === 0) return undefined;
  const names = new Set(dominantPlanets.map((p) => p.toLowerCase()));
  return {
    sun: names.has("sun"),
    moon: names.has("moon"),
    mars: names.has("mars"),
    venus: names.has("venus"),
    jupiter: names.has("jupiter"),
    saturn: names.has("saturn"),
    pluto: names.has("pluto"),
  };
}

function aspectSignaturesFromSnapshot(snapshot: EphemerisSnapshot): AspectSignatureFlags | undefined {
  const aspects = snapshot.aspects ?? [];
  if (!aspects.length) return undefined;
  let trines = 0;
  let squares = 0;
  let opps = 0;
  for (const a of aspects) {
    if (a.type === "trine") trines++;
    else if (a.type === "square") squares++;
    else if (a.type === "opposition") opps++;
  }
  const totalMajor = trines + squares + opps;
  if (!totalMajor) return undefined;
  const trineHeavy = trines >= 2 && trines / totalMajor >= 0.4;
  const squareHeavy = squares >= 2 && squares / totalMajor >= 0.4;
  const oppositionHeavy = opps >= 2 && opps / totalMajor >= 0.4;
  if (!trineHeavy && !squareHeavy && !oppositionHeavy) {
    return {
      trineHeavy: false,
      squareHeavy: false,
      oppositionHeavy: false,
    };
  }
  return {
    trineHeavy,
    squareHeavy,
    oppositionHeavy,
  };
}

/**
 * Deterministic narrative plan for a 30-second composition.
 * Pure function: same architecture + payload + plan ⇒ same plan.
 */
export function buildCompositionNarrativePlan(
  architecture: ArchitectureOutput,
  featureVec: FeatureVec,
  payload: ControlSurfacePayload,
  plan: Plan,
  semanticCore: SemanticCore
): CompositionNarrativePlan {
  const snapshot: EphemerisSnapshot = architecture.snapshot;
  const g = architecture.guidance;

  const nar = extractNarrativeScalarsFromSemanticCore(semanticCore);
  const primaryElement = nar.primaryElement as PrimaryElement;
  const secondaryElement = nar.secondaryElement as PrimaryElement | undefined;

  const modalityFromPayload = modalityBalanceFromLabel(payload.modality);
  const modalityBalance = {
    cardinal: clamp01(0.7 * nar.modalityBalance.cardinal + 0.3 * modalityFromPayload.cardinal),
    fixed: clamp01(0.7 * nar.modalityBalance.fixed + 0.3 * modalityFromPayload.fixed),
    mutable: clamp01(0.7 * nar.modalityBalance.mutable + 0.3 * modalityFromPayload.mutable),
  };

  const tensionIndex = nar.tensionIndex;
  const clusterDensity = clamp01(featureVec[33] ?? 0);

  const shimmer = clamp01(g.motionProfile.shimmer);
  const brightnessIndex = clamp01(0.55 * (1 - tensionIndex) + 0.45 * shimmer);

  const gravity = clamp01(g.motionProfile.gravity);
  const resolutionIndex = nar.resolutionIndex;

  const arcShape = arcShapeFromGuidance({
    arcBias: g.arcBias,
    motion: g.motionProfile.motion,
    flow: g.motionProfile.flow,
    tensionIndex,
  });

  const energyCurve = energyCurveFromMotion(g.motionProfile.motion, g.motionProfile.gravity);

  const peakWindow = peakWindowFromArcBias(g.arcBias);

  const moonPhase = clamp01(snapshot.moonPhase);
  const plutoDepth = architecture.personality?.subsystems?.outers?.plutoDepth ?? 0;

  const tonalPolarity = nar.tonalPolarity as TonalPolarity;

  const endingStyle = endingStyleFromChart({
    primaryElement,
    tonalPolarity,
    gravity,
    flow: g.motionProfile.flow,
    moonPhase,
    plutoDepth,
  });

  const densityProfile = densityProfileFromFeatures({
    densityBias: g.densityBias,
    clusterDensity,
  });

  const rhythmicDrive = rhythmicDriveFromMotion({
    motion: g.motionProfile.motion,
    aspectTension: clamp01(
      typeof payload.aspect_tension === "number" ? payload.aspect_tension : tensionIndex
    ),
  });

  const astroSummary = astroSummaryFromSnapshot(snapshot, featureVec, payload.modality);
  const stellium = stelliumFromSnapshot(snapshot, clusterDensity, primaryElement);
  const angularDominance = angularDominanceFromSnapshot(snapshot);
  const luminaryDominance = luminaryDominanceFromSummary(astroSummary.dominant_planets ?? []);
  const planetarySignatures = planetarySignaturesFromSummary(astroSummary.dominant_planets ?? []);
  const aspectSignatures = aspectSignaturesFromSnapshot(snapshot);

  const toneHints = deriveCrossSurfaceToneHintsFromSemanticCore(semanticCore);

  void plan;

  return {
    primaryElement,
    secondaryElement,
    modalityBalance,
    brightnessIndex,
    tensionIndex,
    resolutionIndex,
    arcShape,
    energyCurve,
    peakWindow,
    endingStyle,
    rhythmicDrive,
    densityProfile,
    tonalPolarity,
    ...(stellium && { stellium }),
    ...(angularDominance && { angularDominance }),
    luminaryDominance,
    ...(planetarySignatures && { planetarySignatures }),
    ...(aspectSignatures && { aspectSignatures }),
    semantic_source_object_hash: semanticCore.provenance.source_object_hash,
    toneHints,
  };
}

