/**
 * Compatibility matches: deterministic scoring from stored vectors only.
 * Used by GET /api/compat/matches. Read-only: no generateArchitecture, no auto-populate.
 * Fail-closed: missing vector returns explicit error.
 */

import { getChartById } from './chart-store';
import * as storage from './storage';

// Path from compiled dist/vnext/vnext/compat/ -> repo root lib
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../lib/vector-store');

/** Deterministic: cosine similarity in 64-D. Same inputs => same score. */
function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  const n = Math.min(a.length, b.length, 64);
  let dot = 0,
    normA = 0,
    normB = 0;
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

/** Sub-scores on selected dims for rationale (deterministic). */
function facetScores(
  a: Float32Array | number[],
  b: Float32Array | number[],
  _mode: string
): { overall: number; elemental: number; tension: number; preference: number } {
  const n = Math.min(a.length, b.length, 64);
  const elemental =
    n >= 31
      ? (cosineSimilarity(
          (a as number[]).slice(27, 31),
          (b as number[]).slice(27, 31)
        ) as number)
      : 0.5;
  const tension =
    n >= 34 ? (Math.abs((a[32] ?? 0) - (b[32] ?? 0)) < 0.3 ? 0.8 : 0.5) : 0.5;
  const preference = n >= 48 ? cosineSimilarity((a as number[]).slice(44, 48), (b as number[]).slice(44, 48)) : 0.5;
  const overall = cosineSimilarity(a, b);
  return { overall, elemental, tension, preference };
}

export type CompatMatchMode = 'friend' | 'lover' | 'rival';

export interface CompatMatchResult {
  userId: string;
  chartId: string;
  displayName?: string;
  score: number;
  facets: Array<{ id: string; name: string; weight: number; score: number; explanation: string }>;
  rationale: string;
  lastUpdated: string;
}

/**
 * Score two feature vectors; deterministic. Returns score 0..1 and short rationale.
 */
export function scoreCompatibility(
  vecA: Float32Array | number[],
  vecB: Float32Array | number[],
  mode: CompatMatchMode
): { score: number; rationale: string; facets: CompatMatchResult['facets'] } {
  const fs = facetScores(vecA, vecB, mode);
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const score = clamp(fs.overall);
  const facets: CompatMatchResult['facets'] = [
    { id: 'overall', name: 'Overall', weight: 1, score: clamp(fs.overall), explanation: 'Chart signature alignment' },
    { id: 'elemental', name: 'Elemental', weight: 0.3, score: clamp(fs.elemental), explanation: 'Element balance similarity' },
    { id: 'tension', name: 'Tension', weight: 0.2, score: clamp(fs.tension), explanation: 'Aspect tension match' },
    { id: 'preference', name: 'Preference', weight: 0.25, score: clamp(fs.preference), explanation: 'Feature preference overlap' },
  ];
  const rationale =
    score >= 0.7
      ? `Strong alignment: elemental ${(fs.elemental * 100).toFixed(0)}%, overall fit ${(score * 100).toFixed(0)}%.`
      : score >= 0.5
        ? `Moderate fit: overall ${(score * 100).toFixed(0)}% with complementary tension.`
        : `Different signatures; overall ${(score * 100).toFixed(0)}% — may offer contrast.`;
  return { score, rationale, facets };
}

function clampScore(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Get compatibility matches for a chart. Read-only: uses stored vectors only.
 * Fail-closed: seeker chart must have stored vector; candidates without vector are skipped.
 * No generateArchitecture, no auto-populate.
 */
export async function getCompatMatches(
  chartId: string,
  mode: CompatMatchMode,
  limit: number
): Promise<CompatMatchResult[]> {
  const chart = await getChartById(chartId);
  if (!chart) throw new Error(`Chart not found: ${chartId}`);

  const vecARow = await vectorStore.getChartVector(chartId);
  if (!vecARow) {
    throw new Error(`Vector not found for chart ${chartId}; run vector population (chart create or explicit populate) first`);
  }

  const candidates = (await storage.ensureMatchCandidateCharts()).filter((c) => c.chartId !== chartId);
  const candidateIds = candidates.map((c) => c.chartId);
  const vecMap = await vectorStore.getChartVectorsByIds(candidateIds);

  const vecA = vecARow.vector64;
  const results: CompatMatchResult[] = [];

  for (const cand of candidates) {
    const vecBRow = vecMap.get(cand.chartId);
    if (!vecBRow) continue; // skip candidates without stored vector

    const { score, rationale, facets } = scoreCompatibility(vecA, vecBRow.vector64, mode);
    results.push({
      userId: cand.userId,
      chartId: cand.chartId,
      displayName: cand.displayName,
      score: clampScore(score),
      facets: facets.map((f) => ({ ...f, score: clampScore(f.score) })),
      rationale,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Stable sort: by score desc, then by chartId asc (deterministic tie-break)
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chartId.localeCompare(b.chartId);
  });
  return results.slice(0, limit);
}
