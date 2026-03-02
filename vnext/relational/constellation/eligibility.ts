/**
 * Phase 5 — Constellation eligibility via cosine similarity to centroids.
 * Uses stored vectors only. Fail-closed if chart vector missing. Deterministic.
 */

import { hashVector64 } from '../compatibility/score';
import type { ConstellationCentroid } from './centroids';
import { CONSTELLATION_CENTROIDS } from './centroids';

// Path from compiled dist/vnext/vnext/relational/constellation/ -> repo root lib
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../../lib/vector-store');

/** Cosine similarity in 64-D, output mapped to [0,1]. Same as score.ts. */
function cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
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

export interface EligibilityResult {
  centroid: {
    slug: string;
    label: string;
    version: string;
    algorithm_version: string;
    eligibility_threshold: number;
  };
  similarity: number;
  vector_hash_user: string;
  centroid_hash: string;
}

/**
 * Get eligible constellations for a chart. Fail-closed if vector missing.
 * Sorted by similarity DESC, centroid.slug ASC.
 */
export async function getConstellationEligibility(chartId: string): Promise<EligibilityResult[]> {
  const vecRow = await vectorStore.getChartVector(chartId);
  if (!vecRow) {
    throw new Error(`Vector not found for chart ${chartId}; run vector population first`);
  }

  const userVec = vecRow.vector64 as number[];
  const vector_hash_user = hashVector64(userVec);

  const results: Array<{
    centroid: ConstellationCentroid;
    similarity: number;
    centroid_hash: string;
  }> = [];

  for (const centroid of CONSTELLATION_CENTROIDS) {
    const sim = cosineSimilarity(userVec, centroid.vector64);
    if (sim >= centroid.eligibility_threshold) {
      results.push({
        centroid,
        similarity: sim,
        centroid_hash: hashVector64(centroid.vector64),
      });
    }
  }

  results.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    return a.centroid.slug.localeCompare(b.centroid.slug);
  });

  return results.map((r) => ({
    centroid: {
      slug: r.centroid.slug,
      label: r.centroid.label,
      version: r.centroid.version,
      algorithm_version: r.centroid.algorithm_version,
      eligibility_threshold: r.centroid.eligibility_threshold,
    },
    similarity: r.similarity,
    vector_hash_user,
    centroid_hash: r.centroid_hash,
  }));
}
