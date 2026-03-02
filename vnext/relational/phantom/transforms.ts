/**
 * Phase 5 — Deterministic phantom transforms.
 * Pure functions. No ML, no ephemeris, no randomness.
 * Element/tension dims: vnext/relational/constants.ts (authoritative: feature-encode 27-30, 32).
 */

import * as crypto from 'crypto';
import type { PhantomProfile } from './profiles';
import {
  FEATURE_ELEMENT_INDICES,
  FEATURE_TENSION_INDEX,
} from '../constants';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function ensure64(vec: number[]): number[] {
  const out = [...vec];
  while (out.length < 64) out.push(0);
  return out.slice(0, 64);
}

/** Deterministic hash of vector. Same as score.ts hashVector64. */
export function hashVector64(vec: number[]): string {
  const arr = vec.length >= 64 ? vec.slice(0, 64) : [...vec, ...new Array(64 - vec.length).fill(0)];
  const str = arr
    .map((x) => (Number.isFinite(x) ? (x as number).toFixed(6) : '0'))
    .join(',');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

export interface PhantomTransformResult {
  phantomVec: number[];
  phantom_hash: string;
  transform_version: string;
}

function applyTransform(
  baseVec: number[],
  profile: PhantomProfile,
  modifier: (out: number[]) => void
): PhantomTransformResult {
  const vec = ensure64(baseVec.map((x) => (Number.isFinite(x) ? x : 0)));
  modifier(vec);
  for (let i = 0; i < 64; i++) {
    vec[i] = clamp01(vec[i]);
  }
  const phantom_hash = hashVector64(vec);
  return {
    phantomVec: vec,
    phantom_hash,
    transform_version: profile.version,
  };
}

export function applyPhantomTransform(
  baseVec: number[],
  profile: PhantomProfile
): PhantomTransformResult {
  switch (profile.transform_type) {
    case 'ideal_complement':
      return transformIdealComplement(baseVec, profile);
    case 'shadow_mirror':
      return transformShadowMirror(baseVec, profile);
    case 'elemental_amplifier':
      return transformElementalAmplifier(baseVec, profile);
    case 'stabilizer':
      return transformStabilizer(baseVec, profile);
    case 'creative_catalyst':
      return transformCreativeCatalyst(baseVec, profile);
    default:
      throw new Error(`Unknown transform_type: ${profile.transform_type}`);
  }
}

/** Elements: normalized(1 - base). Tension: 1 - base[32]. Rest unchanged. */
function transformIdealComplement(baseVec: number[], profile: PhantomProfile): PhantomTransformResult {
  return applyTransform(baseVec, profile, (out) => {
    const inverted = FEATURE_ELEMENT_INDICES.map((i) => 1 - (out[i] ?? 0));
    const sum = inverted.reduce((s, x) => s + x, 0);
    const norm = sum > 0 ? inverted.map((x) => x / sum) : [0.25, 0.25, 0.25, 0.25];
    FEATURE_ELEMENT_INDICES.forEach((i, j) => {
      out[i] = norm[j];
    });
    out[FEATURE_TENSION_INDEX] = 1 - (out[FEATURE_TENSION_INDEX] ?? 0);
  });
}

/** Mirror: return base vector unchanged. Interpretation as "shadow self" is semantic. */
function transformShadowMirror(baseVec: number[], profile: PhantomProfile): PhantomTransformResult {
  return applyTransform(baseVec, profile, () => {
    /* shadow_mirror: no modification; base vector returned */
  });
}

/** Boost dominant element by factor. Renormalize. */
function transformElementalAmplifier(
  baseVec: number[],
  profile: PhantomProfile
): PhantomTransformResult {
  const boost = (profile.transform_params?.boost_factor as number) ?? 1.25;
  return applyTransform(baseVec, profile, (out) => {
    const vals = FEATURE_ELEMENT_INDICES.map((i) => out[i] ?? 0);
    let maxIdx = 0;
    for (let j = 1; j < vals.length; j++) {
      if (vals[j] > vals[maxIdx]) maxIdx = j;
    }
    vals[maxIdx] = vals[maxIdx] * boost;
    const sum = vals.reduce((s, x) => s + x, 0);
    const norm = sum > 0 ? vals.map((x) => x / sum) : [0.25, 0.25, 0.25, 0.25];
    FEATURE_ELEMENT_INDICES.forEach((i, j) => {
      out[i] = norm[j];
    });
  });
}

/** Reduce tension; mix elements toward uniform. */
function transformStabilizer(baseVec: number[], profile: PhantomProfile): PhantomTransformResult {
  const tensionFactor = (profile.transform_params?.tension_factor as number) ?? 0.7;
  const alpha = (profile.transform_params?.element_mix_alpha as number) ?? 0.35;
  return applyTransform(baseVec, profile, (out) => {
    out[FEATURE_TENSION_INDEX] = (out[FEATURE_TENSION_INDEX] ?? 0) * tensionFactor;
    const baseEl = FEATURE_ELEMENT_INDICES.map((i) => out[i] ?? 0);
    const uniform = [0.25, 0.25, 0.25, 0.25];
    const mixed = baseEl.map((b, j) => (1 - alpha) * b + alpha * uniform[j]);
    const sum = mixed.reduce((s, x) => s + x, 0);
    const norm = sum > 0 ? mixed.map((x) => x / sum) : [0.25, 0.25, 0.25, 0.25];
    FEATURE_ELEMENT_INDICES.forEach((i, j) => {
      out[i] = norm[j];
    });
  });
}

/** Increase tension; push dominant up, weakest down. Renormalize. */
function transformCreativeCatalyst(
  baseVec: number[],
  profile: PhantomProfile
): PhantomTransformResult {
  const delta = (profile.transform_params?.tension_delta as number) ?? 0.15;
  return applyTransform(baseVec, profile, (out) => {
    out[FEATURE_TENSION_INDEX] = clamp01((out[FEATURE_TENSION_INDEX] ?? 0) + delta);
    const vals = FEATURE_ELEMENT_INDICES.map((i) => out[i] ?? 0);
    let maxIdx = 0;
    let minIdx = 0;
    for (let j = 1; j < vals.length; j++) {
      if (vals[j] > vals[maxIdx]) maxIdx = j;
      if (vals[j] < vals[minIdx]) minIdx = j;
    }
    const pushed = [...vals];
    pushed[maxIdx] = clamp01(pushed[maxIdx] + 0.15);
    pushed[minIdx] = clamp01(pushed[minIdx] - 0.1);
    const sum = pushed.reduce((s, x) => s + x, 0);
    const norm = sum > 0 ? pushed.map((x) => x / sum) : [0.25, 0.25, 0.25, 0.25];
    FEATURE_ELEMENT_INDICES.forEach((i, j) => {
      out[i] = norm[j];
    });
  });
}
