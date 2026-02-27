/**
 * Phase 5 — Intent-weighted 1:1 compatibility scoring.
 * Uses stored vectors only. No generateArchitecture. Deterministic.
 * Facet math matches vnext/compat/matches.ts (duplicated for isolation).
 */

import * as crypto from 'crypto';
import type { IntentProfile } from '../intent-profiles';
import { getIntentProfileById, getIntentProfileBySlug } from '../intent-profiles';

// Path from compiled dist/vnext/vnext/relational/compatibility/ -> repo root lib (5 levels up)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../../lib/vector-store');

export interface FacetBreakdown {
  overall: number;
  elemental: number;
  tension: number;
  preference: number;
}

/** Deterministic: cosine similarity in 64-D. Same inputs => same score. */
function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  const n = Math.min(a.length, b.length, 64);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const x = typeof a[i] === 'number' ? (a[i] as number) : 0;
    const y = typeof b[i] === 'number' ? (b[i] as number) : 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom <= 0) return 0;
  const raw = dot / denom;
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}

/**
 * Compute facet breakdown. Same math as vnext/compat/matches.ts facetScores.
 */
export function computeFacetBreakdown(
  vecA: Float32Array | number[],
  vecB: Float32Array | number[]
): FacetBreakdown {
  const n = Math.min(vecA.length, vecB.length, 64);
  const a = vecA;
  const b = vecB;
  const elemental =
    n >= 31
      ? cosineSimilarity(
          (a as number[]).slice(27, 31),
          (b as number[]).slice(27, 31)
        )
      : 0.5;
  const tension =
    n >= 34 ? (Math.abs((a[32] ?? 0) - (b[32] ?? 0)) < 0.3 ? 0.8 : 0.5) : 0.5;
  const preference =
    n >= 48
      ? cosineSimilarity((a as number[]).slice(44, 48), (b as number[]).slice(44, 48))
      : 0.5;
  const overall = cosineSimilarity(a, b);
  return { overall, elemental, tension, preference };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Score two vectors using intent profile weights.
 * score = weighted sum of facet scores; weights from profile.facet_weights.
 */
export function scoreWithIntent(
  vecA: Float32Array | number[],
  vecB: Float32Array | number[],
  profile: IntentProfile
): { score: number; facets: FacetBreakdown } {
  const facets = computeFacetBreakdown(vecA, vecB);
  const { facet_weights } = profile;
  const raw =
    facets.overall * facet_weights.overall +
    facets.elemental * facet_weights.elemental +
    facets.tension * facet_weights.tension +
    facets.preference * facet_weights.preference;
  const score = clamp01(raw);
  return { score, facets };
}

/** Stable hash of vector for provenance. Deterministic. */
export function hashVector64(vec: Float32Array | number[]): string {
  const arr = vec.length >= 64 ? vec : new Array(64).fill(0);
  const str = Array.from(arr)
    .slice(0, 64)
    .map((x) => (Number.isFinite(x) ? (x as number).toFixed(6) : '0'))
    .join(',');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

export interface IntentScoringResult {
  score: number;
  facet_breakdown: FacetBreakdown;
  intent_profile_id: string;
  intent_profile_version: string;
  intent_profile_hash: string;
  encoder_version: string;
  algorithm_version: string;
  vector_hash_a: string;
  vector_hash_b: string;
}

/**
 * Score two charts by intent. Uses stored vectors only. Fail-closed if either missing.
 */
export async function scoreChartsByIntent(
  chartIdA: string,
  chartIdB: string,
  intentProfileIdOrSlug: string
): Promise<IntentScoringResult> {
  const vecRowA = await vectorStore.getChartVector(chartIdA);
  if (!vecRowA) {
    throw new Error(`Vector not found for chart ${chartIdA}; run vector population first`);
  }
  const vecRowB = await vectorStore.getChartVector(chartIdB);
  if (!vecRowB) {
    throw new Error(`Vector not found for chart ${chartIdB}; run vector population first`);
  }

  const profile = intentProfileIdOrSlug.startsWith('intent_')
    ? getIntentProfileById(intentProfileIdOrSlug)
    : getIntentProfileBySlug(intentProfileIdOrSlug);

  const vecA = vecRowA.vector64;
  const vecB = vecRowB.vector64;
  const { score, facets } = scoreWithIntent(vecA, vecB, profile);

  const vector_hash_a = hashVector64(vecA);
  const vector_hash_b = hashVector64(vecB);
  const encoder_version = vecRowA.encoderVersion ?? 'v1';

  return {
    score,
    facet_breakdown: facets,
    intent_profile_id: profile.id,
    intent_profile_version: profile.version,
    intent_profile_hash: profile.profile_hash,
    encoder_version,
    algorithm_version: profile.algorithm_version,
    vector_hash_a,
    vector_hash_b,
  };
}

export interface CompatResultForSort {
  score: number;
  vector_hash: string;
  chart_id: string;
}

/**
 * Compare two compatibility results for deterministic sort.
 * Order: score DESC, vector_hash ASC, chart_id ASC.
 */
export function compareCompatResults(
  a: CompatResultForSort,
  b: CompatResultForSort
): number {
  if (b.score !== a.score) return b.score - a.score;
  const hashCmp = a.vector_hash.localeCompare(b.vector_hash);
  if (hashCmp !== 0) return hashCmp;
  return a.chart_id.localeCompare(b.chart_id);
}
