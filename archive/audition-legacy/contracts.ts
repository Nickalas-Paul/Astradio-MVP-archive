// contracts.ts - Type definitions for the Teacher Audition system

export type ChartContext = {
  planets: Record<'sun'|'moon'|'mercury'|'venus'|'mars'|'jupiter'|'saturn'|'uranus'|'neptune'|'pluto', number>;
  houses: [number,number,number,number,number,number,number,number,number,number,number,number];
  aspects?: Array<{a:string,b:string,type:string,orb:number}>;
  moonPhase?: number;  // 0..1
  dominantElements?: Record<'fire'|'earth'|'air'|'water', number>;
  clusters?: unknown;
};

export type Vector6 = [number,number,number,number,number,number]; // normalized 0..1

export type FeatureVector = number[];    // fixed FEATURE_LEN

export type TeacherScaler = {
  x_mean: number[]; x_std: number[];
  y_mean: number[]; y_std: number[];
  version: string;
};

export type CompositionEvent =
  | { type:'note';  t:number; dur:number; pitch:number; vel:number }
  | { type:'chord'; t:number; dur:number; pitches:number[]; vel:number }
  | { type:'perc';  t:number; dur:number; id:string; vel:number };

export type Composition = {
  events: CompositionEvent[];
  analysis?: { melodic_activity?: number };
  meta: { bpm:number; key?:string; scale?:string };
};

export type QualityReport = {
  passed: boolean;
  score: number;                 // 0..100
  failedGates: string[];         // in fail order
};

export type AuditionCase = {
  chartIndex: number;
  chart: ChartContext;
  vector_raw?: number[];         // pre-clamp from model
  vector?: Vector6;              // 0..1
  composition?: Composition;
  quality?: QualityReport;
  renderUrl?: string;            // present only for the single winner
  error?: string;                // case-level error, if any
};

export type AuditionSummary = {
  total: number; passed: number; failed: number;
  preClampVariance: Record<'tempo_energy'|'rhythm_density'|'harmonic_tension'|'brightness'|'texture_space'|'melodic_activity', number>;
  winnerIndex?: number;          // index in cases[]
  cases: AuditionCase[];
};
