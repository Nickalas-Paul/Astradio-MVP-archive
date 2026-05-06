/**
 * Community Compatibility V1 — feature fusion only.
 * Encoder (encodeFeatures) is read-only; we merge two already-encoded 64-dim vectors.
 */

import type { FeatureVec } from '../contracts';
import type { RelationshipMode } from './types';

const FEATURE_LEN = 64;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Default weights for blend_v1 — symmetric for all canonical modes (Phase 6C: deprecated asymmetric mentor weights removed). */
const DEFAULT_WEIGHTS: Record<RelationshipMode, { wA: number; wB: number }> = {
  friends: { wA: 0.5, wB: 0.5 },
  lovers: { wA: 0.5, wB: 0.5 },
  neutral: { wA: 0.5, wB: 0.5 },
};

export interface MergeFeatureVectorsOptions {
  relationshipMode?: RelationshipMode;
  wA?: number;
  wB?: number;
}

/**
 * Merge two 64-dim feature vectors with optional relationship-mode weights.
 * Output is deterministic: same inputs => same Float32Array(64).
 * Uses JS number math then casts to Float32Array; values clamped to [0,1].
 */
export function mergeFeatureVectors(
  vecA: Float32Array | number[],
  vecB: Float32Array | number[],
  opts: MergeFeatureVectorsOptions = {}
): Float32Array {
  const a = vecA.length >= FEATURE_LEN ? vecA : new Float32Array(64);
  const b = vecB.length >= FEATURE_LEN ? vecB : new Float32Array(64);

  let wA = opts.wA;
  let wB = opts.wB;
  if (opts.relationshipMode && (wA === undefined || wB === undefined)) {
    const def = DEFAULT_WEIGHTS[opts.relationshipMode];
    wA = wA ?? def.wA;
    wB = wB ?? def.wB;
  }
  wA = wA ?? 0.5;
  wB = wB ?? 0.5;
  const sum = wA + wB;
  const nA = sum > 0 ? wA / sum : 0.5;
  const nB = sum > 0 ? wB / sum : 0.5;

  const out = new Float32Array(FEATURE_LEN);
  for (let i = 0; i < FEATURE_LEN; i++) {
    const va = Number.isFinite(a[i]) ? a[i] : 0;
    const vb = Number.isFinite(b[i]) ? b[i] : 0;
    const v = nA * va + nB * vb;
    out[i] = clamp01(v);
  }
  return out as FeatureVec;
}
