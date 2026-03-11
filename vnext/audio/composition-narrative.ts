import type { EphemerisSnapshot, FeatureVec, Plan } from "../contracts";
import type { ControlSurfacePayload } from "../explainer/contracts";
import type { ArchitectureOutput } from "../core/architecture-engine";

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
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
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

/**
 * Deterministic narrative plan for a 30-second composition.
 * Pure function: same architecture + payload + plan ⇒ same plan.
 */
export function buildCompositionNarrativePlan(
  architecture: ArchitectureOutput,
  featureVec: FeatureVec,
  payload: ControlSurfacePayload,
  plan: Plan
): CompositionNarrativePlan {
  const snapshot: EphemerisSnapshot = architecture.snapshot;
  const g = architecture.guidance;

  const elementBlend = g.elementBlend;
  const primaryElement = dominantElementFromBlend(elementBlend);
  const secondaryElement = secondaryElementFromBlend(elementBlend, primaryElement);

  const modalityBalance = modalityBalanceFromLabel(payload.modality);

  const tensionIndex = clamp01(featureVec[32] ?? 0);
  const clusterDensity = clamp01(featureVec[33] ?? 0);

  const shimmer = clamp01(g.motionProfile.shimmer);
  const brightnessIndex = clamp01(
    0.55 * (1 - tensionIndex) + 0.45 * shimmer
  );

  const gravity = clamp01(g.motionProfile.gravity);
  const resolutionIndex = clamp01(
    0.6 * gravity + 0.4 * (1 - tensionIndex * 0.7)
  );

  const arcShape = arcShapeFromGuidance({
    arcBias: g.arcBias,
    motion: g.motionProfile.motion,
    flow: g.motionProfile.flow,
    tensionIndex,
  });

  const energyCurve = energyCurveFromMotion(
    g.motionProfile.motion,
    g.motionProfile.gravity
  );

  const peakWindow = peakWindowFromArcBias(g.arcBias);

  const moonPhase = clamp01(snapshot.moonPhase);
  const plutoDepth =
    architecture.personality?.subsystems?.outers?.plutoDepth ?? 0;

  const tonalPolarity = tonalPolarityFromBrightness(brightnessIndex);

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
      typeof payload.aspect_tension === "number"
        ? payload.aspect_tension
        : tensionIndex
    ),
  });

  void plan; // plan is present for future extensions; unused but part of deterministic signature.

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
  };
}

