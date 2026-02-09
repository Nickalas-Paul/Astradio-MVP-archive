// vnext/astro/personality-profile.ts
// Personality Profile v1: deterministic from FeatureVec + EphemerisSnapshot only.

import type { EphemerisSnapshot, FeatureVec } from "../contracts";
import type { ElementBlend, MotionProfile } from "./guidance";

export const PERSONALITY_VERSION = "pp.v1" as const;

export interface PersonalityProfileV1 {
  version: typeof PERSONALITY_VERSION;
  temperament: {
    elements: { fire: number; air: number; water: number; earth: number };
    activation: number;
    stability: number;
    expressiveness: number;
    warmth: number;
    cohesion: number;
    gravity: number;
  };
  subsystems: {
    moon: { climate: number; permeability: number };
    sun: { presence: number; centeredness: number };
    mercury: { agility: number; precision: number };
    venus: { softness: number; consonance: number };
    mars: { propulsion: number; edge: number };
    saturn: { restraint: number; simplicity: number };
    outers: { plutoDepth: number; neptuneMist: number; uranusEdge: number };
  };
  emphasis: {
    innerWorld: number;
    relational: number;
    publicRole: number;
    voiceSelf: number;
  };
  reveal: {
    encounter: { core: number; inner: number; style: number };
    recognition: { core: number; inner: number; style: number };
    integration: { core: number; inner: number; style: number };
  };
  seed: string;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Planet lon from snapshot (0..360) or 0. */
function planetLon(snap: EphemerisSnapshot, name: string): number {
  const p = snap.planets.find((x) => x.name === name);
  return p?.lon ?? 0;
}

/** Normalize to 0..1; if applied as undertone, scale outers to 0..0.35 before storing. */
function outersClamp(x: number): number {
  return clamp01(x / 0.35);
}

/**
 * Compute PersonalityProfileV1 from featureVec + snapshot + motionProfile + elementBlend.
 * Pure and deterministic. Seed set by caller (payload.hash).
 */
export function computePersonalityProfileV1(
  featureVec: FeatureVec,
  chartContext: EphemerisSnapshot,
  motionProfile: MotionProfile,
  elementBlend: ElementBlend,
  seed: string
): PersonalityProfileV1 {
  const fire = elementBlend.fire;
  const air = elementBlend.air;
  const water = elementBlend.water;
  const earth = elementBlend.earth;
  const tension = featureVec[32] ?? 0;
  const cluster = featureVec[33] ?? 0;
  const moonPhase = featureVec[31] ?? 0.5;

  const elements = { fire, air, water, earth };

  const activation = clamp01(fire * 0.55 + air * 0.25 + water * 0.15 + earth * 0.05);
  const fixedProxy = 1 - cluster * 0.5 - tension * 0.5;
  const saturnProxy = 1 - (featureVec[6] ?? 0.5);
  const stability = clamp01(earth * 0.45 + fixedProxy * 0.35 + saturnProxy * 0.2);
  const saturnRestraint = clamp01(earth * 0.5 + (1 - motionProfile.motion) * 0.5);
  const expressiveness = clamp01((1 - saturnRestraint) * 0.5 + (fire + air) * 0.5);
  const moonClimate = clamp01(water * 0.5 + moonPhase * 0.3 + (1 - tension) * 0.2);
  const warmth = clamp01((water + earth) * 0.6 + moonClimate * 0.4);
  const mutableProxy = tension * 0.5 + (1 - cluster) * 0.5;
  const neptuneMistRaw = clamp01((featureVec[8] ?? 0.5) * 0.4 + water * 0.3) * 0.35;
  const cohesion = clamp01((1 - neptuneMistRaw / 0.35) * 0.5 + (1 - mutableProxy) * 0.5);
  const plutoDepthRaw = clamp01((featureVec[9] ?? 0.5) * 0.3 + earth * 0.2) * 0.35;
  const gravity = clamp01(earth * 0.55 + saturnRestraint * 0.25 + outersClamp(plutoDepthRaw) * 0.2);

  const moon = {
    climate: moonClimate,
    permeability: clamp01(water * 0.5 + moonPhase * 0.4 + (1 - tension) * 0.2),
  };
  const sun = {
    presence: clamp01(gravity * 0.5 + stability * 0.5),
    centeredness: clamp01(gravity + (1 - tension) * 0.3),
  };
  const mercury = {
    agility: clamp01(air * 0.5 + motionProfile.motion * 0.5),
    precision: clamp01(air * 0.4 + (1 - moonPhase) * 0.3 + 0.3),
  };
  const venus = {
    softness: clamp01((water + earth) * 0.6 + (1 - fire) * 0.2),
    consonance: clamp01(1 - tension * 0.4),
  };
  const mars = {
    propulsion: clamp01(fire * 0.5 + motionProfile.articulation * 0.5),
    edge: clamp01(fire * 0.4 + air * 0.3),
  };
  const saturn = {
    restraint: saturnRestraint,
    simplicity: clamp01(earth * 0.5 + (1 - motionProfile.motion) * 0.5),
  };
  const plutoDepth = outersClamp(plutoDepthRaw);
  const neptuneMist = outersClamp(neptuneMistRaw);
  const uranusEdge = outersClamp(clamp01((featureVec[7] ?? 0.5) * 0.3 + air * 0.2) * 0.35);
  const outers = { plutoDepth, neptuneMist, uranusEdge };

  const innerWorld = clamp01(water * 0.3 + gravity * 0.25 + plutoDepth * 0.25 + neptuneMist * 0.2);
  const relational = clamp01(air * 0.35 + venus.softness * 0.35 + mars.propulsion * 0.3);
  const publicRole = clamp01(earth * 0.35 + saturn.restraint * 0.35 + sun.presence * 0.3);
  const voiceSelf = clamp01((fire + air) * 0.4 + mercury.agility * 0.3 + sun.presence * 0.3);
  const emphasis = { innerWorld, relational, publicRole, voiceSelf };

  let encounter = { core: 0.7, inner: 0.2, style: 0.1 };
  let recognition = { core: 0.45, inner: 0.3, style: 0.25 };
  const integration = { core: 0.65, inner: 0.25, style: 0.1 };

  if (innerWorld >= 0.5) {
    recognition = { core: 0.45, inner: 0.4, style: 0.15 };
  } else if (relational >= 0.5) {
    recognition = { core: 0.45, inner: 0.2, style: 0.35 };
  }
  recognition.core = clamp01(recognition.core);
  recognition.inner = clamp01(recognition.inner);
  recognition.style = clamp01(recognition.style);
  const sumR = recognition.core + recognition.inner + recognition.style;
  if (sumR > 0) {
    recognition.core /= sumR;
    recognition.inner /= sumR;
    recognition.style /= sumR;
  }
  encounter.core = Math.max(0.4, encounter.core);
  recognition.core = Math.max(0.4, recognition.core);
  integration.core = Math.max(0.4, integration.core);

  return {
    version: PERSONALITY_VERSION,
    temperament: {
      elements,
      activation,
      stability,
      expressiveness,
      warmth,
      cohesion,
      gravity,
    },
    subsystems: { moon, sun, mercury, venus, mars, saturn, outers },
    emphasis,
    reveal: { encounter, recognition, integration },
    seed,
  };
}
