/**
 * ExplainSpec Contracts v1.0
 * Stable intermediate representation for text generation (treat text like MIDI: derived from canonical inputs).
 * 
 * Design principles:
 * - ExplainSpec is the single source of truth for what we claim
 * - Rendering is separate and can evolve without changing the spec
 * - Supports single-chart and comparative-chart use cases
 * - Deterministic: all variation seeded by payload.hash
 */

import type { EphemerisSnapshot, FeatureVec, Plan } from '../contracts';
import type { PlanSummary } from './plan-summary';
import type { GuidanceSummary } from './guidance-atoms';
import type { AstroProfile } from '../astro/profile-from-snapshot';

export type ExplainMode = "single" | "comparison";

/**
 * Element blend (normalized 0-1, sum ≈ 1).
 */
export type ElementBlend = {
  fire: number;
  earth: number;
  air: number;
  water: number;
};

/**
 * Bucket values for tension, clustering, density, etc.
 */
export type BucketValue = 'low' | 'med' | 'high';

/**
 * Astrological signatures: element blend, dominant planets, tension/clustering signals.
 */
export type SignatureFacts = {
  elementBlend: ElementBlend;
  dominantPlanets: string[]; // 1-3 planets
  tensionBucket: BucketValue;
  clusteringBucket: BucketValue;
  moonPhaseBucket?: BucketValue; // Optional
};

/**
 * Psychology facts: temperament, attention style, pacing, relating style.
 * Derived deterministically from signatures + plan.
 */
export type PsychologyFacts = {
  temperamentWords: string[]; // 2-4 adjectives
  attentionStyle: string; // e.g., "focused", "scattered", "rhythmic"
  pacing: string; // e.g., "measured", "urgent", "flowing"
  relatingStyle: string; // e.g., "direct", "nuanced", "expansive"
};

/**
 * Music facts: tempo, key, density, register, articulation, motion, harmonic posture, arc summary.
 */
export type MusicFacts = {
  bpm: number;
  key: string;
  densityBucket: BucketValue;
  registerBias: 'lower' | 'mid' | 'higher';
  articulationBucket: BucketValue; // legato vs staccato feel
  motionBucket: BucketValue; // stepwise vs leaps
  harmonicPosture: 'root-stable' | 'color-shifting';
  arcSummary: {
    begin: string; // Encounter phase summary
    middle: string; // Recognition phase summary
    end: string; // Integration phase summary
  };
  planSummary: PlanSummary; // Event counts, intervals, etc.
};

/**
 * Chart explain facts: snapshot hash, feature hash, element blend, planets, buckets, plan summary.
 */
export type ChartExplainFacts = {
  snapshotHash: string; // SHA256 of snapshot
  featureHash: string; // SHA256 of featureVec
  elementBlend: ElementBlend;
  dominantPlanets: string[];
  buckets: {
    tension: BucketValue;
    clustering: BucketValue;
    density: BucketValue;
  };
  planSummary: PlanSummary;
};

/**
 * Comparison facts: shared elements, contrasts, friction points, resonance.
 */
export type ComparisonFacts = {
  sharedElements: string[]; // Elements present in both charts
  contrasts: Array<{ aspect: string; a: string; b: string }>; // e.g., "A has high tension, B has low tension"
  frictionPoints: Array<{ metric: string; delta: number; note: string }>; // Tension deltas, element mismatches
  resonance: number; // 0-1, element overlap score
};

/**
 * Comparison music facts: how the two charts blend musically.
 */
export type ComparisonMusicFacts = {
  tempoBlend: string; // e.g., "A's moderate tempo complements B's steady pulse"
  densityBlend: string;
  harmonicRelationship: string; // e.g., "A's root-stable foundation supports B's color-shifting melodies"
  arcBlend: string; // How the arcs interact
};

/**
 * Evidence item: backing signal for a claim (feature index bucket, plan metric, or gate outcome).
 */
export type EvidenceItem = {
  kind: "feature" | "plan" | "gate" | "synthetic";
  key: string; // e.g., "feature[32]" (tension), "plan.bpm", "gate.melody_arc"
  value: number | string;
  note: string; // Human-readable explanation
};

/**
 * ExplainSpec: stable intermediate representation for text generation.
 */
export type ExplainSpec = {
  specVersion: "ExplainSpecV1";
  mode: ExplainMode;
  seed: string; // payload.hash
  titles: {
    signatures: string; // "Astrological Signatures"
    significance: string; // "Personal Significance"
    musical: string; // "Musical Identity and Flow"
  };
  single?: {
    signatures: SignatureFacts;
    psychology: PsychologyFacts;
    music: MusicFacts;
    /** AstroProfile from snapshot (sign-based elements, placements, angles, aspects). Explainer-only. */
    profile?: AstroProfile;
    /** 3–5 planets for placement sentences (luminaries + nearAngle + aspect involvement). */
    prominentPlanets?: AstroProfile['planets'];
    /** 3–5 aspects for aspect sentences (orb tightness + luminary involvement). */
    prominentAspects?: AstroProfile['aspects'];
    /** 1:1:1 correspondence: each prominent factor has astro / psych / music line */
    factorMap?: {
      factors: Array<{
        id: string;
        astro: string;
        psych: string;
        music: string;
      }>;
    };
  };
  comparison?: {
    a: ChartExplainFacts;
    b: ChartExplainFacts;
    delta: ComparisonFacts;
    music: ComparisonMusicFacts;
  };
  listeningCues: string[]; // 3-6 unique listening anchors
  evidence: EvidenceItem[]; // Plan metrics + feature buckets referenced in claims
  warnings?: string[]; // Gate fail hints, determinism notes
};

/**
 * Inputs for building a single-chart ExplainSpec.
 */
export type ExplainSpecSingleInputs = {
  seed: string;
  snapshot: EphemerisSnapshot;
  featureVec: FeatureVec;
  guidanceSummary: GuidanceSummary;
  plan: Plan;
  planSummary: PlanSummary;
  gateReport: import('./contracts').GateReport;
};

/**
 * Inputs for building a comparison ExplainSpec.
 */
export type ExplainSpecComparisonInputs = {
  seed: string;
  a: {
    snapshot: EphemerisSnapshot;
    featureVec: FeatureVec;
    guidanceSummary: GuidanceSummary;
    plan: Plan;
    planSummary: PlanSummary;
  };
  b: {
    snapshot: EphemerisSnapshot;
    featureVec: FeatureVec;
    guidanceSummary: GuidanceSummary;
    plan: Plan;
    planSummary: PlanSummary;
  };
  delta: {
    elementBlendDiff: { fire: number; earth: number; air: number; water: number };
    tensionDiff: number;
    clusteringDiff: number;
    dominantPlanetOverlap: string[];
  };
  gateReport?: import('./contracts').GateReport;
};

/**
 * Rendered explanation section (output from renderer).
 */
export type ExplanationSection = {
  id: "signatures" | "significance" | "musical";
  title: string;
  text: string; // Paragraphs separated by \n\n
  bullets?: string[]; // Only for musical section (and optionally comparisons)
};
