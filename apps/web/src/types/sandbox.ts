/**
 * Phase 4B — Sandbox frontend types.
 * Frontend contract; Next API adapts to backend SandboxDraft contract.
 */

import type { CanonicalLocation } from './location';

/** Phase 8H: canonical body set (core 10 + Chiron, Ceres, Pallas, Juno, Vesta). */
export type PlanetKey =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
  | 'chiron' | 'ceres' | 'pallas' | 'juno' | 'vesta';

export type SandboxBirth = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: CanonicalLocation;
  houseSystem?: string;
};

export type SandboxOverrides = {
  planets: Partial<Record<PlanetKey, { lonDeg: number }>>;
  angles?: {
    ascDeg?: number;
    mcDeg?: number;
  };
};

export type EphemerisSnapshot = {
  ts: string;
  tz: string;
  lat: number;
  lon: number;
  houseSystem: string;
  planets: Array<{ name: string; lon: number; lat?: number; speed?: number }>;
  houses: [number, number, number, number, number, number, number, number, number, number, number, number];
  aspects: Array<{
    bodyA: string;
    bodyB: string;
    type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
    orb: number;
    exactAngle?: number;
    dynamics?: string;
    strength?: number;
    exactness?: number;
    priorityBase?: number;
    motion?: 'applying' | 'separating';
  }>;
  moonPhase: number;
  dominantElements: { fire: number; earth: number; air: number; water: number };
};

export type SandboxDraft = {
  birth: SandboxBirth | null;
  baseSnapshot: EphemerisSnapshot | null;
  overrides: SandboxOverrides;
  overriddenSnapshot: EphemerisSnapshot | null;
  hash?: {
    birthHash: string;
    overridesHash: string;
    combinedHash?: string;
  };
};

export type SandboxReportExplanation = {
  spec: string;
  sections: Array<{ id: string; title: string; text: string; bullets?: string[] }>;
};

export type SandboxReport = {
  features: number[];
  personality: any;
  guidance: any;
  explanation: SandboxReportExplanation;
  seed: string;
  meta: {
    combinedHash: string;
    data_classification?: {
      explanation: string;
      features_personality_guidance: string;
    };
    canonical_object_hash?: string;
  };
};
