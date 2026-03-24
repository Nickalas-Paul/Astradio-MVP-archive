import type { Plan } from "../contracts";
import type { ControlSurfacePayload } from "../explainer/contracts";
import type { SemanticCore } from "../semantic/semantic-core";
import {
  deriveCrossSurfaceToneHintsFromSemanticCore,
  extractAngularNarrativeFromSemanticCore,
  extractAspectNarrativeFromSemanticCore,
  extractGravityScalarFromSemanticCore,
  extractLuminaryNarrativeFromSemanticCore,
  extractMotionScalarFromSemanticCore,
  extractNarrativeScalarsFromSemanticCore,
  extractStelliumNarrativeFromSemanticCore,
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
  strength: number;
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

  stellium?: StelliumSignature;
  angularDominance?: AngularDominance;
  luminaryDominance: LuminaryDominance;
  /** Not populated in Phase C (no per-planet claims in SemanticCore); Lyria prompt skips planet-specific clauses when absent. */
  planetarySignatures?: PlanetarySignatureFlags;
  aspectSignatures: AspectSignatureFlags;
  semantic_source_object_hash: string;
  toneHints: CrossSurfaceToneHints;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
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

/** Ending style from SemanticCore-derived scalars only (tension/resolution proxy former snapshot-only inputs). */
function endingStyleFromSemantic(params: {
  primaryElement: PrimaryElement;
  tonalPolarity: TonalPolarity;
  gravity: number;
  flow: number;
  resolutionIndex: number;
  tensionIndex: number;
}): EndingStyle {
  const { primaryElement, tonalPolarity, gravity, flow, resolutionIndex, tensionIndex } = params;
  const deep = tensionIndex >= 0.6;
  const bright = tonalPolarity === "bright";
  const dark = tonalPolarity === "dark";

  if (primaryElement === "fire" && bright && gravity >= 0.45) {
    return "triumphant";
  }
  if (primaryElement === "earth" && gravity >= 0.6 && !dark) {
    return "resolved";
  }
  if (primaryElement === "water" && (flow >= 0.6 || resolutionIndex >= 0.6)) {
    return deep || dark ? "suspended" : "dissipating";
  }
  if (primaryElement === "air" && !bright && resolutionIndex <= 0.4) {
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

function densityProfileFromSemanticCoreScalars(params: {
  tensionIndex: number;
  resolutionIndex: number;
  stelliumStrength: number;
}): DensityProfile {
  const densityBias = clamp01(0.5 + 0.5 * (params.tensionIndex - params.resolutionIndex));
  const clusterDensity = clamp01(params.stelliumStrength);
  const d = clamp01(0.5 + 0.25 * densityBias + 0.25 * clusterDensity);
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

/**
 * Deterministic narrative plan for composition staging.
 * Phase C: inputs are SemanticCore (+ control payload aspect_tension only). No snapshot / featureVec / guidance side channels.
 * Final waveform may still vary by external provider; semantic staging is deterministic for a fixed SemanticCore.
 */
export function buildCompositionNarrativePlan(
  payload: ControlSurfacePayload,
  plan: Plan,
  semanticCore: SemanticCore
): CompositionNarrativePlan {
  void plan;

  const nar = extractNarrativeScalarsFromSemanticCore(semanticCore);
  const primaryElement = nar.primaryElement as PrimaryElement;
  const secondaryElement = nar.secondaryElement as PrimaryElement | undefined;

  const modalityBalance = { ...nar.modalityBalance };

  const tensionIndex = nar.tensionIndex;
  const resolutionIndex = nar.resolutionIndex;
  const motion = extractMotionScalarFromSemanticCore(semanticCore);
  const gravity = extractGravityScalarFromSemanticCore(semanticCore);

  const arcBias = clamp01(resolutionIndex - tensionIndex);
  const brightnessIndex = clamp01(0.55 * (1 - tensionIndex) + 0.45 * resolutionIndex);

  const arcShape = arcShapeFromGuidance({
    arcBias,
    motion,
    flow: resolutionIndex,
    tensionIndex,
  });

  const energyCurve = energyCurveFromMotion(motion, gravity);
  const peakWindow = peakWindowFromArcBias(arcBias);

  const tonalPolarity = nar.tonalPolarity as TonalPolarity;

  const endingStyle = endingStyleFromSemantic({
    primaryElement,
    tonalPolarity,
    gravity,
    flow: resolutionIndex,
    resolutionIndex,
    tensionIndex,
  });

  const stellium = extractStelliumNarrativeFromSemanticCore(semanticCore, primaryElement);
  const stelliumStrength = stellium?.strength ?? 0.5;

  const densityProfile = densityProfileFromSemanticCoreScalars({
    tensionIndex,
    resolutionIndex,
    stelliumStrength,
  });

  const aspectTension =
    typeof payload.aspect_tension === "number" && Number.isFinite(payload.aspect_tension)
      ? clamp01(payload.aspect_tension)
      : tensionIndex;

  const rhythmicDrive = rhythmicDriveFromMotion({
    motion,
    aspectTension,
  });

  const angularDominance = extractAngularNarrativeFromSemanticCore(semanticCore);
  const luminaryDominance = extractLuminaryNarrativeFromSemanticCore(semanticCore);
  const aspectSignatures = extractAspectNarrativeFromSemanticCore(semanticCore);

  const toneHints = deriveCrossSurfaceToneHintsFromSemanticCore(semanticCore);

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
    aspectSignatures,
    semantic_source_object_hash: semanticCore.provenance.source_object_hash,
    toneHints,
  };
}
