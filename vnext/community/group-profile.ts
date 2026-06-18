/**
 * GroupProfile — aggregate personality object from member artifacts.
 * No synthetic snapshot. Snapshot → FeatureVec → Personality/Guidance is per-member only.
 * Aggregation: deterministic mean of features and (when provided) personality/guidance numerics.
 */

import type { FeatureVec } from '../contracts';

const FEATURE_LEN = 64;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export type AggregationMode = 'mean' | 'mean_normalized';

export interface GroupProfileInput {
  groupId: string;
  memberChartIds?: string[];
  memberFeatureVecs?: Float32Array[] | number[][];
  aggregationMode?: AggregationMode;
  seed?: string;
}

/** Honest output: no astroProfileAgg (no fake snapshot). personalityAgg/guidanceAgg only when derived from member artifacts. */
export interface GroupProfileOutput {
  groupId: string;
  memberCount: number;
  featuresAgg: Float32Array;
  personalityAgg?: import('../astro/personality-profile').PersonalityProfileV1;
  guidanceAgg?: import('../astro/guidance').AstroGuidance & {
    elementBlend: import('../astro/guidance').ElementBlend;
    motionProfile: import('../astro/guidance').MotionProfile;
    narrativeArc: import('../astro/guidance').NarrativeArc;
    personality?: import('../astro/personality-profile').PersonalityProfileV1;
  };
  explanation: {
    spec: string;
    sections: Array<{ id: string; title: string; text: string; bullets?: string[] }>;
  };
  updatedAt: string;
}

/** Member artifact: features + personality + guidance from architecture-engine per chart. */
export interface MemberArtifact {
  features: Float32Array | number[];
  personality: import('../astro/personality-profile').PersonalityProfileV1;
  guidance: import('../astro/guidance').AstroGuidance & {
    elementBlend: import('../astro/guidance').ElementBlend;
    motionProfile: import('../astro/guidance').MotionProfile;
    narrativeArc: import('../astro/guidance').NarrativeArc;
    personality: import('../astro/personality-profile').PersonalityProfileV1;
  };
}

/**
 * Aggregate multiple 64-D feature vectors into one by normalized mean.
 * Deterministic: same inputs => same output.
 */
export function aggregateFeatureVectors(
  vectors: (Float32Array | number[])[],
  mode: AggregationMode = 'mean_normalized'
): Float32Array {
  if (vectors.length === 0) {
    const z = new Float32Array(FEATURE_LEN);
    return z as FeatureVec;
  }
  const out = new Float32Array(FEATURE_LEN);
  for (let i = 0; i < FEATURE_LEN; i++) {
    let sum = 0;
    for (const v of vectors) {
      sum += Number.isFinite(v[i]) ? (v[i] as number) : 0;
    }
    const mean = sum / vectors.length;
    out[i] = clamp01(mean);
  }
  if (mode === 'mean_normalized') {
    const sum = out[27] + out[28] + out[29] + out[30] || 1;
    out[27] = clamp01(out[27] / sum);
    out[28] = clamp01(out[28] / sum);
    out[29] = clamp01(out[29] / sum);
    out[30] = clamp01(out[30] / sum);
  }
  return out as FeatureVec;
}

const clamp11 = (x: number) => Math.max(-1, Math.min(1, x));

/** Recursively average numeric fields (0..1); nested objects recurse; non-numeric/string kept as first. */
function aggregatePersonalityNumerics(items: Record<string, unknown>[]): Record<string, unknown> {
  if (items.length === 0) return {};
  const out: Record<string, unknown> = {};
  const keys = new Set<string>();
  for (const item of items) {
    for (const k of Object.keys(item)) keys.add(k);
  }
  for (const k of keys) {
    const vals = items.map((i) => i[k]).filter((v) => v !== undefined);
    if (vals.length === 0) continue;
    const first = vals[0];
    if (typeof first === 'number' && vals.every((v) => typeof v === 'number')) {
      const mean = (vals as number[]).reduce((a, b) => a + b, 0) / vals.length;
      out[k] = clamp01(mean);
    } else if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
      out[k] = aggregatePersonalityNumerics(vals as Record<string, unknown>[]);
    } else if (Array.isArray(first) && vals.every((v) => Array.isArray(v) && (v as number[]).every((x) => typeof x === 'number'))) {
      const len = Math.min(...(vals as number[][]).map((a) => a.length));
      const arr = [];
      for (let i = 0; i < len; i++) {
        const mean = (vals as number[][]).reduce((a, v) => a + (v[i] ?? 0), 0) / vals.length;
        arr.push(clamp01(mean));
      }
      out[k] = arr;
    } else {
      out[k] = first;
    }
  }
  return out;
}

/** Average guidance numeric fields; bias fields clamped to [-1, 1], element/motion to 0..1. */
function aggregateGuidance(
  members: MemberArtifact[]
): NonNullable<GroupProfileOutput['guidanceAgg']> {
  if (members.length === 0) {
    return {
      tempoBias: 0,
      arcBias: 0,
      densityBias: 0,
      motifIdx: 0,
      cadenceIdx: 0,
      elementBlend: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
      motionProfile: { motion: 0.5, articulation: 0.5, shimmer: 0.5, gravity: 0.5, flow: 0.5 },
      narrativeArc: { encounterSec: 15, recognitionSec: 30, integrationSec: 15 }
    };
  }
  const g = members.map((m) => m.guidance);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const blend = {
    fire: clamp01(sum(g.map((x) => x.elementBlend.fire))),
    earth: clamp01(sum(g.map((x) => x.elementBlend.earth))),
    air: clamp01(sum(g.map((x) => x.elementBlend.air))),
    water: clamp01(sum(g.map((x) => x.elementBlend.water)))
  };
  const s = blend.fire + blend.earth + blend.air + blend.water || 1;
  const elementBlend = { fire: blend.fire / s, earth: blend.earth / s, air: blend.air / s, water: blend.water / s };
  return {
    tempoBias: clamp11(sum(g.map((x) => x.tempoBias))),
    arcBias: clamp11(sum(g.map((x) => x.arcBias))),
    densityBias: clamp11(sum(g.map((x) => x.densityBias))),
    motifIdx: Math.floor(sum(g.map((x) => x.motifIdx))) % 8,
    cadenceIdx: Math.floor(sum(g.map((x) => x.cadenceIdx))) % 4,
    elementBlend,
    motionProfile: {
      motion: clamp01(sum(g.map((x) => x.motionProfile.motion))),
      articulation: clamp01(sum(g.map((x) => x.motionProfile.articulation))),
      shimmer: clamp01(sum(g.map((x) => x.motionProfile.shimmer))),
      gravity: clamp01(sum(g.map((x) => x.motionProfile.gravity))),
      flow: clamp01(sum(g.map((x) => x.motionProfile.flow)))
    },
    narrativeArc: {
      encounterSec: Math.round(sum(g.map((x) => x.narrativeArc.encounterSec))),
      recognitionSec: Math.round(sum(g.map((x) => x.narrativeArc.recognitionSec))),
      integrationSec: Math.round(sum(g.map((x) => x.narrativeArc.integrationSec)))
    }
  };
}

/** Build a minimal group explanation from feature vector only (no snapshot). */
function buildMinimalExplanationFromFeatures(featuresAgg: Float32Array | number[]): GroupProfileOutput['explanation'] {
  const fire = featuresAgg[27] ?? 0.25;
  const earth = featuresAgg[28] ?? 0.25;
  const air = featuresAgg[29] ?? 0.25;
  const water = featuresAgg[30] ?? 0.25;
  const tension = featuresAgg[32] ?? 0.5;
  const cluster = featuresAgg[33] ?? 0.5;
  const sections: Array<{ id: string; title: string; text: string; bullets?: string[] }> = [
    {
      id: 'group_tone',
      title: 'Group Tone',
      text: `Aggregate element blend: fire ${(fire * 100).toFixed(0)}%, earth ${(earth * 100).toFixed(0)}%, air ${(air * 100).toFixed(0)}%, water ${(water * 100).toFixed(0)}%.`,
      bullets: []
    },
    {
      id: 'friction_growth',
      title: 'Friction + growth edges',
      text: tension >= 0.6 ? 'Higher collective tension: dynamic, growth-oriented.' : tension >= 0.4 ? 'Moderate tension, balanced flow.' : 'Lower tension, ease and alignment.',
      bullets: cluster >= 0.5 ? ['Denser aspect clustering'] : ['Lighter aspect spread']
    }
  ];
  return { spec: 'GroupProfileV1', sections };
}

/** Build group explanation from aggregated personality and guidance (no plan/snapshot). */
function buildGroupExplanationFromAggregates(
  personalityAgg: NonNullable<GroupProfileOutput['personalityAgg']>,
  guidanceAgg: NonNullable<GroupProfileOutput['guidanceAgg']>
): GroupProfileOutput['explanation'] {
  const sections: Array<{ id: string; title: string; text: string; bullets?: string[] }> = [
    {
      id: 'signatures',
      title: 'Group Signatures',
      text: `Collective temperament: activation ${(personalityAgg.temperament.activation * 100).toFixed(0)}%, stability ${(personalityAgg.temperament.stability * 100).toFixed(0)}%, expressiveness ${(personalityAgg.temperament.expressiveness * 100).toFixed(0)}%.`,
      bullets: [
        `Element blend (aggregate): fire ${(guidanceAgg.elementBlend.fire * 100).toFixed(0)}%, earth ${(guidanceAgg.elementBlend.earth * 100).toFixed(0)}%, air ${(guidanceAgg.elementBlend.air * 100).toFixed(0)}%, water ${(guidanceAgg.elementBlend.water * 100).toFixed(0)}%`
      ]
    },
    {
      id: 'how_connects',
      title: 'How this group connects',
      text: `Emphasis: inner world ${(personalityAgg.emphasis.innerWorld * 100).toFixed(0)}%, relational ${(personalityAgg.emphasis.relational * 100).toFixed(0)}%, public role ${(personalityAgg.emphasis.publicRole * 100).toFixed(0)}%, voice ${(personalityAgg.emphasis.voiceSelf * 100).toFixed(0)}%.`
    },
    {
      id: 'friction_growth',
      title: 'Friction + growth edges',
      text: 'Aggregate profile for narrative context; no music generated.',
      bullets: [
        `Tempo bias (aggregate): ${guidanceAgg.tempoBias.toFixed(2)}`,
        `Arc bias (aggregate): ${guidanceAgg.arcBias.toFixed(2)}`,
        `Density bias (aggregate): ${guidanceAgg.densityBias.toFixed(2)}`
      ]
    }
  ];
  return { spec: 'GroupProfileV1', sections };
}

/**
 * Compute GroupProfile from member artifacts (features + personality + guidance per member).
 * No snapshot synthesis. personalityAgg and guidanceAgg are numeric aggregates.
 */
export function computeGroupProfileFromMemberArtifacts(input: {
  groupId: string;
  members: MemberArtifact[];
  aggregationMode?: AggregationMode;
  seed?: string;
}): GroupProfileOutput {
  const { groupId, members, aggregationMode = 'mean_normalized', seed } = input;
  if (members.length === 0) {
    const featuresAgg = aggregateFeatureVectors([], aggregationMode);
    return {
      groupId,
      memberCount: 0,
      featuresAgg,
      explanation: buildMinimalExplanationFromFeatures(featuresAgg),
      updatedAt: new Date().toISOString()
    };
  }
  const featuresAgg = aggregateFeatureVectors(
    members.map((m) => m.features),
    aggregationMode
  );
  const personalityAgg = aggregatePersonalityNumerics(
    members.map((m) => m.personality as unknown as Record<string, unknown>)
  ) as unknown as NonNullable<GroupProfileOutput['personalityAgg']>;
  personalityAgg.seed = seed || `group_${groupId}`;
  const guidanceAgg = aggregateGuidance(members);
  const explanation = buildGroupExplanationFromAggregates(personalityAgg, guidanceAgg);
  return {
    groupId,
    memberCount: members.length,
    featuresAgg,
    personalityAgg,
    guidanceAgg,
    explanation,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Compute GroupProfile from member feature vectors only.
 * Returns featuresAgg + minimal explanation (no personalityAgg/guidanceAgg; no snapshot).
 */
export function computeGroupProfileFromVectors(input: {
  groupId: string;
  memberFeatureVecs: Float32Array[] | number[][];
  aggregationMode?: AggregationMode;
  seed?: string;
}): GroupProfileOutput {
  const { groupId, memberFeatureVecs, aggregationMode = 'mean_normalized' } = input;
  const featuresAgg = aggregateFeatureVectors(memberFeatureVecs, aggregationMode);
  const explanation = buildMinimalExplanationFromFeatures(featuresAgg);
  return {
    groupId,
    memberCount: memberFeatureVecs.length,
    featuresAgg,
    explanation,
    updatedAt: new Date().toISOString()
  };
}
