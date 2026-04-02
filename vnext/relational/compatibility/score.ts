import crypto from 'crypto';
import { computeCompatibilitySystem } from '../../compatibility/service';
import type { IntentProfile } from '../intent-profiles';

export interface FacetBreakdown {
  overall: number;
  elemental: number;
  tension: number;
  preference: number;
}

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
  return Math.max(0, Math.min(1, (dot / denom + 1) / 2));
}

export function computeFacetBreakdown(
  vecA: Float32Array | number[],
  vecB: Float32Array | number[]
): FacetBreakdown {
  return {
    overall: cosineSimilarity(vecA, vecB),
    elemental: cosineSimilarity((vecA as number[]).slice(27, 31), (vecB as number[]).slice(27, 31)),
    tension: Math.abs(((vecA as number[])[32] ?? 0) - ((vecB as number[])[32] ?? 0)) < 0.3 ? 0.8 : 0.5,
    preference: cosineSimilarity((vecA as number[]).slice(44, 48), (vecB as number[]).slice(44, 48)),
  };
}

export function scoreWithIntent(
  vecA: Float32Array | number[],
  vecB: Float32Array | number[],
  profile: IntentProfile
): { score: number; facets: FacetBreakdown } {
  const facets = computeFacetBreakdown(vecA, vecB);
  const raw =
    facets.overall * profile.facet_weights.overall +
    facets.elemental * profile.facet_weights.elemental +
    facets.tension * profile.facet_weights.tension +
    facets.preference * profile.facet_weights.preference;
  return { score: Math.max(0, Math.min(1, raw)), facets };
}

function scoreByIntentProfileSlug(slug: string, scoring: Awaited<ReturnType<typeof computeCompatibilitySystem>>['scoring']): number {
  const cohesion = scoring.derived_indices.cohesion_index;
  const tension = scoring.derived_indices.tension_index;
  const transformation = scoring.derived_indices.transformation_index;
  const stability = scoring.derived_indices.stability_index;
  if (slug.includes('rival')) return Math.max(0, Math.min(1, tension * 0.45 + transformation * 0.3 + scoring.scalar_outputs.overall_relational_intensity * 0.25));
  if (slug.includes('lover') || slug.includes('dating')) return Math.max(0, Math.min(1, cohesion * 0.35 + transformation * 0.4 + stability * 0.25));
  return Math.max(0, Math.min(1, cohesion * 0.4 + stability * 0.35 + scoring.scalar_outputs.overall_relational_intensity * 0.25));
}

export async function scoreChartsByIntent(
  chartIdA: string,
  chartIdB: string,
  intentProfileIdOrSlug: string
): Promise<IntentScoringResult> {
  const computed = await computeCompatibilitySystem({
    chartIds: [chartIdA, chartIdB],
    relationshipBindingId: null,
  });
  return {
    score: scoreByIntentProfileSlug(intentProfileIdOrSlug, computed.scoring),
    facet_breakdown: {
      overall: computed.scoring.scalar_outputs.overall_relational_intensity,
      elemental: computed.scoring.derived_indices.cohesion_index,
      tension: computed.scoring.derived_indices.tension_index,
      preference: computed.scoring.derived_indices.transformation_index,
    },
    intent_profile_id: intentProfileIdOrSlug,
    intent_profile_version: 'compatibility_projection_v1',
    intent_profile_hash: computed.scoring.compatibility_field_hash,
    encoder_version: Object.values(computed.scoring.provenance.encoder_versions)[0] ?? 'v1',
    algorithm_version: computed.scoring.scoring_algorithm_version,
    vector_hash_a: computed.scoring.vector_hashes[computed.field.created_from.chart_ids_ordered[0]],
    vector_hash_b: computed.scoring.vector_hashes[computed.field.created_from.chart_ids_ordered[1]],
  };
}

export interface CompatResultForSort {
  score: number;
  vector_hash: string;
  chart_id: string;
}

export function compareCompatResults(a: CompatResultForSort, b: CompatResultForSort): number {
  if (b.score !== a.score) return b.score - a.score;
  const hashCmp = a.vector_hash.localeCompare(b.vector_hash);
  if (hashCmp !== 0) return hashCmp;
  return a.chart_id.localeCompare(b.chart_id);
}
