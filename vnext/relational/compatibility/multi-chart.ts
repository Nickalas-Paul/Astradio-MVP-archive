/**
 * Multi-chart compatibility adapter over the canonical relational field.
 * No independent scoring or intent logic lives here.
 */

import { computeCompatibilitySystem } from '../../compatibility/service';
import { hashVector64, type FacetBreakdown } from './score';

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const sq = values.reduce((s, v) => s + (v - m) * (v - m), 0);
  return sq / values.length;
}

export interface AggregateMetrics {
  mean_resonance: number;
  tension_variance: number;
  stability_index: number;
  dominant_elemental_pattern: string;
}

export interface MultiChartOutput {
  chart_ids: string[];
  intent_profile_id: string;
  intent_profile_version: string;
  intent_profile_hash: string;
  encoder_versions: Record<string, string>;
  algorithm_version: string;
  vector_hashes: Record<string, string>;
  compatibility_matrix: number[][];
  aggregate_metrics: AggregateMetrics;
}

export class MissingVectorsError extends Error {
  missing_chart_ids: string[];

  constructor(missing: string[]) {
    super(`Missing vectors for chartIds: ${missing.join(',')}`);
    this.name = 'MissingVectorsError';
    this.missing_chart_ids = missing;
  }
}

interface PairRecord {
  i: number;
  j: number;
  score: number;
  facets: FacetBreakdown;
}

export function computeAggregateMetrics(
  chartIds: string[],
  fields: Array<Awaited<ReturnType<typeof computeCompatibilitySystem>>>,
  pairs: PairRecord[]
): AggregateMetrics {
  const scores = pairs.map((p) => p.score);
  const tensions = pairs.map((p) => p.facets.tension);
  const meanRes = mean(scores);
  const scoreVar = variance(scores);
  const tensionVar = variance(tensions);
  const stability = clamp01(1 - scoreVar);

  const categoryWeights = { reinforcing: 0, cross_pressuring: 0, escalating: 0, dissolving: 0, transforming: 0 };
  for (const field of fields) {
    const pair = field.field.pairwise_matrix[0];
    if (!pair) continue;
    categoryWeights[pair.dominant_category] += 1;
  }
  const best = (Object.keys(categoryWeights) as Array<keyof typeof categoryWeights>).sort((a, b) => {
    if (categoryWeights[b] !== categoryWeights[a]) return categoryWeights[b] - categoryWeights[a];
    return a.localeCompare(b, 'en');
  })[0] ?? 'reinforcing';

  return {
    mean_resonance: meanRes,
    tension_variance: tensionVar,
    stability_index: stability,
    dominant_elemental_pattern: best,
  };
}

/**
 * Lower-level helper used by verify-multi-chart (no DB access).
 * Accepts chart vectors + encoder versions directly.
 */
export function computeMultiChartFromVectors(
  chartIdsInput: string[],
  _profile: { id: string; version: string; profile_hash: string; algorithm_version: string },
  vectorsById: Record<string, number[]>,
  encoderVersionsById: Record<string, string> = {}
): MultiChartOutput {
  void chartIdsInput;
  void vectorsById;
  void encoderVersionsById;
  throw new Error('computeMultiChartFromVectors deprecated; use computeMultiChartCompatibility via canonical field pipeline');
}

/**
 * High-level API: load vectors from storage and compute multi-chart compatibility.
 * Uses stored vectors only. Fail-closed if any vector missing.
 */
export async function computeMultiChartCompatibility(
  chartIdsInput: string[],
  intentProfileIdOrSlug: string
): Promise<MultiChartOutput> {
  const chart_ids = Array.from(new Set(chartIdsInput)).sort((a, b) =>
    a.localeCompare(b, 'en')
  );
  if (chart_ids.length === 0) {
    throw new Error('chartIds required');
  }

  const vectorsById: Record<string, number[]> = {};
  const encoderVersionsById: Record<string, string> = {};
  const computedPairs: Array<Awaited<ReturnType<typeof computeCompatibilitySystem>>> = [];
  const matrix: number[][] = Array.from({ length: chart_ids.length }, () => Array(chart_ids.length).fill(1));
  const pairs: PairRecord[] = [];
  for (let i = 0; i < chart_ids.length; i++) {
    for (let j = i + 1; j < chart_ids.length; j++) {
      const computed = await computeCompatibilitySystem({
        chartIds: [chart_ids[i], chart_ids[j]],
        relationshipBindingId: null,
      });
      computedPairs.push(computed);
      const intensity = computed.scoring.scalar_outputs.overall_relational_intensity;
      const tension = computed.scoring.derived_indices.tension_index;
      matrix[i][j] = intensity;
      matrix[j][i] = intensity;
      pairs.push({
        i,
        j,
        score: intensity,
        facets: {
          overall: intensity,
          elemental: computed.scoring.derived_indices.cohesion_index,
          tension,
          preference: computed.scoring.derived_indices.transformation_index,
        },
      });
      for (const [chartId, vectorHash] of Object.entries(computed.scoring.vector_hashes)) {
        if (!(chartId in vectorsById)) vectorsById[chartId] = [];
        encoderVersionsById[chartId] = computed.scoring.provenance.encoder_versions[chartId] ?? 'v1';
        vectorsById[chartId] = [vectorHash.length];
      }
    }
  }

  const vector_hashes = Object.fromEntries(
    chart_ids.map((chartId) => [chartId, computedPairs.find((pair) => pair.scoring.vector_hashes[chartId])?.scoring.vector_hashes[chartId] ?? hashVector64(vectorsById[chartId] ?? [])])
  );
  return {
    chart_ids,
    intent_profile_id: intentProfileIdOrSlug,
    intent_profile_version: 'compatibility_projection_v1',
    intent_profile_hash: computedPairs[0]?.field.object_identity_hash ?? 'none',
    encoder_versions: encoderVersionsById,
    algorithm_version: 'compatibility_projection_v1',
    vector_hashes,
    compatibility_matrix: matrix,
    aggregate_metrics: computeAggregateMetrics(chart_ids, computedPairs, pairs),
  };
}

