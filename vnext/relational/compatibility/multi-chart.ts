/**
 * Phase 5 — Multi-chart compatibility (pairwise matrix + aggregates).
 * Uses stored vectors only (vectorStore). Deterministic. Fail-closed on missing vectors.
 */

import { FEATURE_ELEMENT_INDICES } from '../constants';
import {
  scoreWithIntent,
  type FacetBreakdown,
  hashVector64,
} from './score';
import type { IntentProfile } from '../intent-profiles';
import { getIntentProfileById, getIntentProfileBySlug } from '../intent-profiles';

// Path from compiled dist/vnext/vnext/relational/compatibility/ -> repo root lib (5 levels up)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../../lib/vector-store');

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

// Invariant: element indices must remain [27, 28, 29, 30] mapping to [fire, earth, air, water].
// If encoder layout changes, this module must be updated explicitly.
(function assertElementIndices() {
  const expected = [27, 28, 29, 30];
  if (
    FEATURE_ELEMENT_INDICES.length !== expected.length ||
    FEATURE_ELEMENT_INDICES.some((v, i) => v !== expected[i])
  ) {
    throw new Error(
      `FEATURE_ELEMENT_INDICES invariant violated in multi-chart: expected [27,28,29,30], got [${FEATURE_ELEMENT_INDICES.join(
        ','
      )}]`
    );
  }
})();

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

type ElementLabel = 'fire' | 'earth' | 'air' | 'water';

// Explicit tie-break order for dominant element: FIRE > EARTH > AIR > WATER.
const ELEMENT_ORDER: ElementLabel[] = ['fire', 'earth', 'air', 'water'];

function dominantElementForVector(vec: number[]): ElementLabel {
  if (!FEATURE_ELEMENT_INDICES.length) return 'fire';
  const vals = FEATURE_ELEMENT_INDICES.map((i) =>
    Number.isFinite(vec[i]) ? (vec[i] as number) : 0
  );
  let maxVal = vals[0];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] > maxVal) maxVal = vals[i];
  }
  // Tie-break by ELEMENT_ORDER priority
  for (let idx = 0; idx < ELEMENT_ORDER.length; idx++) {
    if (vals[idx] === maxVal) {
      return ELEMENT_ORDER[idx];
    }
  }
  return 'fire';
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
  vectors: Record<string, number[]>,
  pairs: PairRecord[]
): AggregateMetrics {
  const scores = pairs.map((p) => p.score);
  const tensions = pairs.map((p) => p.facets.tension);
  const meanRes = mean(scores);
  const scoreVar = variance(scores);
  const tensionVar = variance(tensions);
  const stability = clamp01(1 - scoreVar);

  const counts: Record<ElementLabel, number> = {
    fire: 0,
    earth: 0,
    air: 0,
    water: 0,
  };

  for (const id of chartIds) {
    const vec = vectors[id] || [];
    const el = dominantElementForVector(vec);
    counts[el] += 1;
  }

  let best: ElementLabel = 'fire';
  let bestCount = counts[best];
  for (const el of ELEMENT_ORDER) {
    if (counts[el] > bestCount) {
      best = el;
      bestCount = counts[el];
    }
  }

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
  profile: IntentProfile,
  vectorsById: Record<string, number[]>,
  encoderVersionsById: Record<string, string> = {}
): MultiChartOutput {
  const chart_ids = Array.from(new Set(chartIdsInput)).sort((a, b) =>
    a.localeCompare(b, 'en')
  );
  if (chart_ids.length === 0) {
    throw new Error('chartIds required');
  }

  const vectors: Record<string, number[]> = {};
  const encoderVersions: Record<string, string> = {};
  const vectorHashes: Record<string, string> = {};
  const missing: string[] = [];

  for (const id of chart_ids) {
    const vec = vectorsById[id];
    if (!vec || !Array.isArray(vec) || vec.length === 0) {
      missing.push(id);
      continue;
    }
    vectors[id] = vec;
    encoderVersions[id] = encoderVersionsById[id] ?? 'v1';
    vectorHashes[id] = hashVector64(vec);
  }

  if (missing.length > 0) {
    throw new MissingVectorsError(missing);
  }

  const n = chart_ids.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(1)
  );
  const pairs: PairRecord[] = [];

  for (let i = 0; i < n; i++) {
    const idA = chart_ids[i];
    const vecA = vectors[idA];
    for (let j = i + 1; j < n; j++) {
      const idB = chart_ids[j];
      const vecB = vectors[idB];
      const { score, facets } = scoreWithIntent(vecA, vecB, profile);
      matrix[i][j] = score;
      matrix[j][i] = score;
      pairs.push({ i, j, score, facets });
    }
  }

  const aggregate_metrics = computeAggregateMetrics(chart_ids, vectors, pairs);

  return {
    chart_ids,
    intent_profile_id: profile.id,
    intent_profile_version: profile.version,
    intent_profile_hash: profile.profile_hash,
    encoder_versions: encoderVersions,
    algorithm_version: profile.algorithm_version,
    vector_hashes: vectorHashes,
    compatibility_matrix: matrix,
    aggregate_metrics,
  };
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

  const profile: IntentProfile = intentProfileIdOrSlug.startsWith('intent_')
    ? getIntentProfileById(intentProfileIdOrSlug)
    : getIntentProfileBySlug(intentProfileIdOrSlug);

  const vecMap: Map<
    string,
    { chartId: string; vector64: number[]; version: string; encoderVersion: string }
  > = await vectorStore.getChartVectorsByIds(chart_ids);

  const vectorsById: Record<string, number[]> = {};
  const encoderVersionsById: Record<string, string> = {};

  for (const id of chart_ids) {
    const row = vecMap.get(id);
    if (!row || !Array.isArray(row.vector64) || row.vector64.length === 0) {
      // We'll fail-closed inside computeMultiChartFromVectors via missing check.
      continue;
    }
    vectorsById[id] = row.vector64 as number[];
    encoderVersionsById[id] = row.encoderVersion ?? 'v1';
  }

  return computeMultiChartFromVectors(
    chart_ids,
    profile,
    vectorsById,
    encoderVersionsById
  );
}

