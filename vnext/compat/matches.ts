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
import { fetchChartSnapshot } from '../core/architecture-engine';
import { encodeFeatures } from '../feature-encode';
import type { FeatureVec } from '../contracts';
import { mergeFeatureVectors } from './fusion';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForAggregate } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import type { RelationshipMode } from './types';

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

function modeToConnectionMode(mode: RelationalIntent): RelationshipMode {
  if (mode === 'friend') return 'friends';
  if (mode === 'lover') return 'lovers';
  if (mode === 'rival') return 'rivals';
  return 'collaborator';
}

function firstSentence(text: string): string {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^[^.!?]+[.!?]?/);
  return (m ? m[0] : trimmed).trim();
}

function projectedLineBySection(
  sections: Array<{ id: string; text?: string }>,
  sectionId: string
): string {
  const sec = sections.find((s) => s.id === sectionId);
  return firstSentence(sec?.text ?? '');
}

function sparseCompatibilityLine(seed: string, kind: 'support' | 'limit' | 'secondary'): string {
  const key = `${seed}:${kind}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = h >>> 0;
  if (kind === 'support') {
    return idx % 2 === 0
      ? 'Interaction signal is weak, so each person tends to decide independently with limited coordination pressure.'
      : 'No strong pair interaction dominates, so timing stays mostly independent and coordination remains light.';
  }
  if (kind === 'secondary') {
    return idx % 2 === 0
      ? 'Domain overlap is limited, so communication and resource decisions stay loosely coupled.'
      : 'With low structural pull, planning and pacing stay parallel rather than tightly integrated.';
  }
  return idx % 2 === 0
    ? 'Directional pressure is low, so escalation risk remains limited unless external constraints increase.'
    : 'Low conflict loading keeps urgency muted, with minimal pressure to reorganize roles.';
}

async function buildProjectedCompatibilityLines(
  chartIdA: string,
  chartIdB: string,
  mode: RelationalIntent,
  seed: string
): Promise<{ primary: string[]; secondary: string[]; limits: string[] }> {
  const [chartA, chartB] = await Promise.all([getChartById(chartIdA), getChartById(chartIdB)]);
  if (!chartA || !chartB) {
    return {
      primary: [sparseCompatibilityLine(seed, 'support')],
      secondary: [sparseCompatibilityLine(seed, 'secondary')],
      limits: [sparseCompatibilityLine(seed, 'limit')],
    };
  }
  const [snapA, snapB] = await Promise.all([
    fetchChartSnapshot({
      date: chartA.date,
      time: chartA.time,
      lat: chartA.lat,
      lon: chartA.lon,
      timezone: chartA.timezone,
    }),
    fetchChartSnapshot({
      date: chartB.date,
      time: chartB.time,
      lat: chartB.lat,
      lon: chartB.lon,
      timezone: chartB.timezone,
    }),
  ]);
  const vecA = encodeFeatures(snapA) as FeatureVec;
  const vecB = encodeFeatures(snapB) as FeatureVec;
  const merged = mergeFeatureVectors(vecA, vecB, { relationshipMode: modeToConnectionMode(mode) }) as FeatureVec;
  const guidance = guidanceFromFeatures(merged, snapA, seed);
  const canonical = buildCanonicalReportForAggregate({
    kind: 'comparison',
    subject_ids: [seed],
    participants: [
      { snapshot: snapA, featureVec: vecA, role: 'primary' },
      { snapshot: snapB, featureVec: vecB, role: 'member_i' },
    ],
    composite: merged,
    anchorIndex: 0,
    control_surface_hash: seed,
    compose_seed: seed,
    guidance,
    relationalWeather: null,
  });
  const core = interpretCanonicalReportObject(canonical);
  const sections = projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface: 'compat_pair',
    tier: 'extended',
    narrativePlan: null,
    aggregateKind: 'comparison',
    connectionMode: modeToConnectionMode(mode),
    participantCount: 2,
  });

  const supportLine =
    projectedLineBySection(sections, 'interaction_map') ||
    projectedLineBySection(sections, 'relational_field') ||
    sparseCompatibilityLine(seed, 'support');
  const secondaryLine =
    projectedLineBySection(sections, 'synthesis_a') ||
    projectedLineBySection(sections, 'significance') ||
    sparseCompatibilityLine(seed, 'secondary');
  const limitLine =
    projectedLineBySection(sections, 'contradiction_map') ||
    projectedLineBySection(sections, 'synthesis_b') ||
    sparseCompatibilityLine(seed, 'limit');

  return {
    primary: [supportLine],
    secondary: [secondaryLine],
    limits: [limitLine],
  };
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
    const projectedLines = await buildProjectedCompatibilityLines(
      chartId,
      cand.chartId,
      mode,
      computed.field.object_identity_hash
    );
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
    results[results.length - 1]!.explanationProfile = {
      ...explanationProfile,
      primarySupports: projectedLines.primary,
      secondarySupports: projectedLines.secondary,
      tensionsOrLimits: projectedLines.limits,
    };
  }

  // Stable sort: by score desc, then by chartId asc (deterministic tie-break)
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chartId.localeCompare(b.chartId);
  });
  return results.slice(0, limit);
}
