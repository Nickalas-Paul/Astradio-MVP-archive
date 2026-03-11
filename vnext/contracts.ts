// vnext/contracts.ts
// Core data contracts for ML-primary astrological audio composer

/** Aspect type with Phase 8H metadata (dynamics, strength, exactness, priorityBase). */
export type SnapshotAspect = {
  a: string;
  b: string;
  type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
  orb: number;
  exactAngle?: number;
  dynamics?: 'amplifying' | 'supportive' | 'tense' | 'flowing' | 'polarizing';
  strength?: number;
  exactness?: number;
  priorityBase?: number;
};

export type EphemerisSnapshot = {
  ts: string; 
  tz: string; 
  lat: number; 
  lon: number; 
  houseSystem: string;
  planets: Array<{ name: string; lon: number; lat?: number; speed?: number }>;
  houses: [number, number, number, number, number, number, number, number, number, number, number, number];
  aspects: SnapshotAspect[];
  moonPhase: number;
  dominantElements: { fire: number; earth: number; air: number; water: number };
};

export type FeatureVec = Float32Array & { length: 64 };

export type EventToken = {
  t0: number; 
  t1: number; 
  pitch: number; 
  velocity: number;
  channel: 'melody' | 'harmony' | 'rhythm' | 'bass'; 
  group?: string;
};

export type Plan = {
  id: string; 
  featureHash: string; 
  durationSec: number; 
  bpm: number; 
  key: string;
  events: EventToken[];
  /** Optional debug metadata for novelty and musicality (no API breaking changes) */
  debug?: {
    progressionId?: number;
    motifId?: number;
    bassPatternId?: number;
    transformationSequence?: string[];
    hookCellId?: string;
    hookCellOccurrences?: number;
    sectionCellUsage?: [number, number, number, number];
    chordToneOnStrongBeatRate?: number;
    averageStepwiseRate?: number;
    leapResolutionRate?: number;
    restDensityPerPhrase?: [number, number, number, number];
    melodyCandidateCount?: number;
    melodyCandidateScores?: number[];
    melodySelectedIndex?: number;
  };
};

export type AuditionResult = {
  passed: boolean; 
  score: number; 
  issues: string[]; 
  repairs: string[];
  ruleQuality?: {
    ok: boolean;
    score: number;
    breakdown: {
      melody: any;
      harmony: any;
      rhythm: any;
    };
  };
};

// Phase 4A/8H: Sandbox Draft contract — canonical body set (core 10 + Chiron, Ceres, Pallas, Juno, Vesta)
export type PlanetKey =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
  | 'chiron' | 'ceres' | 'pallas' | 'juno' | 'vesta';

export type SandboxBirth = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  lat: number;
  lon: number;
  tz?: string; // optional, defaults to UTC
  houseSystem?: string; // optional, defaults to 'placidus'
};

export type SandboxOverrides = {
  planets: Partial<Record<PlanetKey, { lonDeg: number }>>; // 0..360, supports decimals
  angles?: {
    ascDeg?: number; // optional in 4A
    mcDeg?: number; // optional in 4A
  };
};

export type SandboxDraft = {
  birth: SandboxBirth;
  baseSnapshot: EphemerisSnapshot;
  overrides: SandboxOverrides;
  overriddenSnapshot?: EphemerisSnapshot;
  hash?: {
    birthHash: string;
    overridesHash: string;
    combinedHash?: string;
  };
};
