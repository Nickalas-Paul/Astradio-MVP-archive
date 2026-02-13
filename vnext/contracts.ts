// vnext/contracts.ts
// Core data contracts for ML-primary astrological audio composer

export type EphemerisSnapshot = {
  ts: string; 
  tz: string; 
  lat: number; 
  lon: number; 
  houseSystem: string;
  planets: Array<{ name: string; lon: number; lat?: number; speed?: number }>;
  houses: [number, number, number, number, number, number, number, number, number, number, number, number];
  aspects: Array<{ a: string; b: string; type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition'; orb: number }>;
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
