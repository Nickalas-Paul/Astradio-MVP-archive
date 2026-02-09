/**
 * Guidance-derived atoms from featureVec only (no planner/astro imports for independence).
 * Deterministic buckets: motion, gravity, shimmer, flow, tension, clustering.
 */

import type { FeatureVec } from '../contracts';

export type GuidanceSummary = {
  motion: 'low' | 'med' | 'high';
  gravity: 'low' | 'med' | 'high';
  shimmer: 'low' | 'med' | 'high';
  flow: 'low' | 'med' | 'high';
  tension: 'low' | 'med' | 'high';
  clustering: 'low' | 'med' | 'high';
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function bucket(v: number): 'low' | 'med' | 'high' {
  if (v < 0.35) return 'low';
  if (v <= 0.65) return 'med';
  return 'high';
}

/**
 * Derive motion profile and tension/clustering from featureVec indices 27–33.
 * Same logic as guidance.ts elementBlend → motionProfile, but self-contained.
 */
export function guidanceSummaryFromFeatureVec(featureVec: FeatureVec): GuidanceSummary {
  const fire = featureVec[27] ?? 0;
  const earth = featureVec[28] ?? 0;
  const air = featureVec[29] ?? 0;
  const water = featureVec[30] ?? 0;
  const sum = fire + earth + air + water || 1;
  const f = clamp01(fire / sum);
  const e = clamp01(earth / sum);
  const a = clamp01(air / sum);
  const w = clamp01(water / sum);

  const motion = clamp01(f * 0.5 + a * 0.3 + (1 - e) * 0.2);
  const articulation = clamp01(f * 0.6 + (1 - w) * 0.4);
  const shimmer = clamp01(a * 0.6 + f * 0.2 + (1 - e) * 0.2);
  const gravity = clamp01(e * 0.5 + w * 0.3 + (1 - a) * 0.2);
  const flow = clamp01(w * 0.5 + a * 0.2 + (1 - f) * 0.3);

  const tension = featureVec[32] ?? 0.5;
  const clustering = featureVec[33] ?? 0.5;

  return {
    motion: bucket(motion),
    gravity: bucket(gravity),
    shimmer: bucket(shimmer),
    flow: bucket(flow),
    tension: bucket(tension),
    clustering: bucket(clustering)
  };
}
