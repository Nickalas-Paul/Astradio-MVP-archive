/**
 * Compatibility matches: ranking adapter over the canonical compatibility field.
 * No independent scoring logic lives here.
 */

import { getChartById } from './chart-store';
import * as storage from './storage';
import { computeCompatibilitySystem } from '../compatibility/service';
import type { RelationalFieldScoreContract } from '../compatibility/contracts';
import type { RelationalIntent } from '../compatibility/relational-intent';
import { canonicalIntentRank } from '../compatibility/intent-rank';
import type { CompatibilityExplanationProfile } from '../compatibility/discovery-explanation';
import { buildCompatibilityExplanationProfile } from '../compatibility/discovery-explanation';

/** @deprecated Use RelationalIntent from ../compatibility/relational-intent */
export type CompatMatchMode = RelationalIntent;

export interface CompatMatchResult {
  userId: string;
  chartId: string;
  displayName?: string;
  score: number;
  facets: Array<{ id: string; name: string; weight: number; score: number; explanation: string }>;
  rationale: string;
  explanationProfile: CompatibilityExplanationProfile;
  lastUpdated: string;
  compatibilityFieldHash?: string;
}

function clampScore(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function facetsFromScoring(scoring: RelationalFieldScoreContract): CompatMatchResult['facets'] {
  return [
    { id: 'cohesion', name: 'Cohesion', weight: 1, score: clampScore(scoring.derived_indices.cohesion_index), explanation: 'Derived from canonical pairwise and trait-field structure' },
    { id: 'tension', name: 'Tension', weight: 1, score: clampScore(scoring.derived_indices.tension_index), explanation: 'Derived from canonical friction and escalation components' },
    { id: 'transformation', name: 'Transformation', weight: 1, score: clampScore(scoring.derived_indices.transformation_index), explanation: 'Derived from canonical transforming and activation components' },
    { id: 'stability', name: 'Stability', weight: 1, score: clampScore(scoring.derived_indices.stability_index), explanation: 'Derived from canonical cohesion, volatility, and domain entropy' },
  ];
}

/**
 * Get compatibility matches for a chart.
 * Ranking only: the canonical field + unified scoring contract remain the single compute path.
 */
export async function getCompatMatches(
  chartId: string,
  mode: RelationalIntent,
  limit: number
): Promise<CompatMatchResult[]> {
  const chart = await getChartById(chartId);
  if (!chart) throw new Error(`Chart not found: ${chartId}`);

  const candidates = (await storage.ensureMatchCandidateCharts()).filter((c) => c.chartId !== chartId);
  const results: CompatMatchResult[] = [];

  for (const cand of candidates) {
    const computed = await computeCompatibilitySystem({
      chartIds: [chartId, cand.chartId],
      relationshipBindingId: null,
    });
    const score = canonicalIntentRank(computed.scoring, mode);
    const explanationProfile = buildCompatibilityExplanationProfile({
      field: computed.field,
      scoring: computed.scoring,
      classification: computed.classification,
      intent: mode,
    });
    results.push({
      userId: cand.userId,
      chartId: cand.chartId,
      displayName: cand.displayName,
      score,
      facets: facetsFromScoring(computed.scoring),
      rationale: explanationProfile.intentFitSummary,
      explanationProfile,
      lastUpdated: new Date().toISOString(),
      compatibilityFieldHash: computed.field.object_identity_hash,
    });
  }

  // Stable sort: by score desc, then by chartId asc (deterministic tie-break)
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chartId.localeCompare(b.chartId);
  });
  return results.slice(0, limit);
}
