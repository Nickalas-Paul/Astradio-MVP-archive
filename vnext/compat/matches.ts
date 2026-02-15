/**
 * Compatibility matches: real vnext 64-D encoder, deterministic scoring.
 * Used by GET /api/compat/matches. Additive; does not change compose or comparisons.
 */

import type { EphemerisSnapshot } from '../contracts';
import { encodeFeatures } from '../feature-encode';
import * as storage from './storage';

const PORT = process.env.PORT || '3000';
const BASE_URL = process.env.COMPAT_CHART_BASE_URL || `http://localhost:${PORT}`;

async function fetchChartSnapshot(
  date: string,
  time: string,
  lat: number,
  lon: number
): Promise<EphemerisSnapshot> {
  const t = time.length === 5 ? time : time.slice(0, 5);
  const q = new URLSearchParams({ date, time: t, lat: String(lat), lon: String(lon) });
  const r = await fetch(`${BASE_URL}/api/chart-snapshot?${q}`);
  if (!r.ok) throw new Error(`chart-snapshot failed: ${r.status}`);
  return r.json() as Promise<EphemerisSnapshot>;
}

function toVec64(chart: storage.Chart): Promise<Float32Array | number[]> {
  return fetchChartSnapshot(chart.date, chart.time, chart.lat, chart.lon).then((snap) =>
    encodeFeatures(snap)
  );
}

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
 * Get compatibility matches for a chart. Uses real encodeFeatures; deterministic candidate set.
 * Caller must have called ensureDefaultProfileChart/ensureMatchCandidateCharts at startup.
 */
export async function getCompatMatches(
  chartId: string,
  mode: CompatMatchMode,
  limit: number
): Promise<CompatMatchResult[]> {
  const chart = storage.getChart(chartId);
  if (!chart) throw new Error(`Chart not found: ${chartId}`);

  const candidates = storage.ensureMatchCandidateCharts().filter((c) => c.chartId !== chartId);
  const vecA = await toVec64(chart);

  const results: CompatMatchResult[] = [];
  for (const cand of candidates) {
    const c = storage.getChart(cand.chartId);
    if (!c) continue;
    const vecB = await toVec64(c);
    const { score, rationale, facets } = scoreCompatibility(vecA, vecB, mode);
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

  // Stable sort: by score desc, then by chartId asc so ties are deterministic.
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chartId.localeCompare(b.chartId);
  });
  return results.slice(0, limit);
}
