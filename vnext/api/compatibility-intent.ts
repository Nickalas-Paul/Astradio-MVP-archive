/**
 * Compatibility intent API: POST /api/compatibility/intent
 * Projection-layer ranking over canonical compatibility fields only.
 */

import type { ChartInput } from '../core/architecture-engine';
import { getChartById } from '../compat/chart-store';
import * as compatStorage from '../compat/storage';
import type { Chart } from '../compat/types';
import { computeCompatibilitySystem } from '../compatibility/service';
import type { RelationalFieldScoreContract } from '../compatibility/contracts';
import type { RelationalIntent } from '../compatibility/relational-intent';
import { canonicalIntentRank } from '../compatibility/intent-rank';
import type { CompatibilityExplanationProfile } from '../compatibility/discovery-explanation';
import { buildCompatibilityExplanationProfile } from '../compatibility/discovery-explanation';
import { getScopedCandidates } from './scope-resolver';
import { fetchChartSnapshot } from '../core/architecture-engine';
import { encodeFeatures } from '../feature-encode';
import type { FeatureVec } from '../contracts';
import { mergeFeatureVectors } from '../compat/fusion';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForAggregate } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import type { RelationshipMode } from '../compat/types';

export type ScopeType = 'my_groups' | 'group' | 'global';

export interface CompatibilityIntentRequest {
  seekerChartId?: string;
  /** Inline chart when seekerChartId not provided */
  chart?: ChartInput;
  intent: RelationalIntent;
  limit?: number;
  scope?: ScopeType;
  groupId?: string;
  seekerUserId?: string;
}

export type ClusterBand = 'ease' | 'spark' | 'growth' | 'complex';

export interface IntentClusterMember {
  userId: string;
  chartId: string;
  displayName?: string;
  descriptors: string[];
  sharedContext?: string[];
  explanationProfile: CompatibilityExplanationProfile;
}

export interface IntentCluster {
  id: string;
  label: string;
  band: ClusterBand;
  members: IntentClusterMember[];
  why: { bullets: string[] };
}

export interface CompatibilityIntentResponse {
  intent: RelationalIntent;
  clusters: IntentCluster[];
  meta?: { scope: ScopeType; candidateCount: number };
}

function assignBand(scoring: RelationalFieldScoreContract): ClusterBand {
  if (scoring.derived_indices.cohesion_index >= 0.68 && scoring.derived_indices.stability_index >= 0.6) return 'ease';
  if (scoring.derived_indices.transformation_index >= 0.65) return 'spark';
  if (scoring.derived_indices.tension_index >= 0.55) return 'growth';
  return 'complex';
}

/** Label for band. */
function bandLabel(band: ClusterBand): string {
  switch (band) {
    case 'ease':
      return 'Easy conversation';
    case 'spark':
      return 'Creative spark';
    case 'growth':
      return 'Growth edge';
    case 'complex':
      return 'Complex blend';
    default:
      return 'Mixed';
  }
}

function intentToConnectionMode(intent: RelationalIntent): RelationshipMode {
  if (intent === 'friend') return 'friends';
  if (intent === 'lover') return 'lovers';
  if (intent === 'rival') return 'rivals';
  return 'collaborator';
}

function firstSentence(text: string): string {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^[^.!?]+[.!?]?/);
  return (m ? m[0] : trimmed).trim();
}

function pickSectionLine(
  sections: Array<{ id: string; text?: string }>,
  sectionId: string
): string {
  const sec = sections.find((s) => s.id === sectionId);
  return firstSentence(sec?.text ?? '');
}

function sparseIntentLine(seed: string, kind: 'support' | 'secondary' | 'limit'): string {
  const key = `${seed}:${kind}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = h >>> 0;
  if (kind === 'support') {
    return idx % 2 === 0
      ? 'Weak interaction signal keeps coordination light, so decisions often proceed independently.'
      : 'No dominant exchange pattern appears, so timing remains mostly independent with low coordination pull.';
  }
  if (kind === 'secondary') {
    return idx % 2 === 0
      ? 'Domain coupling is limited, so communication and resource pacing stay loosely linked.'
      : 'Low structural overlap keeps planning tracks parallel rather than tightly synchronized.';
  }
  return idx % 2 === 0
    ? 'Directional pressure is minimal, so urgency and escalation remain constrained.'
    : 'Conflict loading is low, so role shifts are limited unless external pressure rises.';
}

function isSparseByScoring(scoring: RelationalFieldScoreContract): boolean {
  const d = scoring.derived_indices;
  const c = scoring.components;
  return (
    d.tension_index <= 0.56 &&
    d.transformation_index <= 0.6 &&
    c.pairwise_volatility_mean <= 0.5 &&
    c.pairwise_friction_mean <= 0.56
  );
}

function hasSystemMetaLanguage(text: string): boolean {
  const t = String(text || '').toLowerCase();
  return (
    t.includes('interaction map:') ||
    t.includes('subclaims') ||
    t.includes('field of view') ||
    t.includes('through-line') ||
    t.includes('synthesis')
  );
}

async function buildProjectedCompatibilityProfile(
  chartIdA: string,
  chartIdB: string,
  intent: RelationalIntent,
  base: CompatibilityExplanationProfile,
  seed: string,
  scoring: RelationalFieldScoreContract
): Promise<CompatibilityExplanationProfile> {
  const [a, b] = await Promise.all([getChartById(chartIdA), getChartById(chartIdB)]);
  if (!a || !b) {
    return {
      ...base,
      primarySupports: [sparseIntentLine(seed, 'support')],
      secondarySupports: [sparseIntentLine(seed, 'secondary')],
      tensionsOrLimits: [sparseIntentLine(seed, 'limit')],
    };
  }
  const [snapA, snapB] = await Promise.all([
    fetchChartSnapshot({ date: a.date, time: a.time, lat: a.lat, lon: a.lon, timezone: a.timezone }),
    fetchChartSnapshot({ date: b.date, time: b.time, lat: b.lat, lon: b.lon, timezone: b.timezone }),
  ]);
  const vecA = encodeFeatures(snapA) as FeatureVec;
  const vecB = encodeFeatures(snapB) as FeatureVec;
  const merged = mergeFeatureVectors(vecA, vecB, {
    relationshipMode: intentToConnectionMode(intent),
  }) as FeatureVec;
  const guidance = guidanceFromFeatures(merged, snapA, seed);
  const report = buildCanonicalReportForAggregate({
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
  const core = interpretCanonicalReportObject(report);
  const sections = projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface: 'compat_pair',
    tier: 'extended',
    narrativePlan: null,
    aggregateKind: 'comparison',
    connectionMode: intentToConnectionMode(intent),
    participantCount: 2,
  });

  const support =
    pickSectionLine(sections, 'interaction_map') ||
    pickSectionLine(sections, 'relational_field') ||
    sparseIntentLine(seed, 'support');
  const secondary =
    pickSectionLine(sections, 'synthesis_a') ||
    pickSectionLine(sections, 'significance') ||
    sparseIntentLine(seed, 'secondary');
  const limit =
    pickSectionLine(sections, 'contradiction_map') ||
    pickSectionLine(sections, 'synthesis_b') ||
    sparseIntentLine(seed, 'limit');

  const sparseRoute = isSparseByScoring(scoring);
  const badProjectionText =
    hasSystemMetaLanguage(support) ||
    hasSystemMetaLanguage(secondary) ||
    hasSystemMetaLanguage(limit);
  if (sparseRoute || badProjectionText) {
    return {
      ...base,
      primarySupports: [sparseIntentLine(seed, 'support')],
      secondarySupports: [sparseIntentLine(seed, 'secondary')],
      tensionsOrLimits: [sparseIntentLine(seed, 'limit')],
    };
  }

  return {
    ...base,
    primarySupports: [support],
    secondarySupports: [secondary],
    tensionsOrLimits: [limit],
  };
}

async function resolveSeekerChartId(seekerChartId?: string, inlineChart?: ChartInput): Promise<string> {
  if (seekerChartId) {
    const chart = await getChartById(seekerChartId);
    if (!chart) throw new Error(`Chart not found: ${seekerChartId}`);
    return seekerChartId;
  }
  if (!inlineChart) {
    throw new Error('Either seekerChartId or chart must be provided');
  }
  const created = await compatStorage.createChart({
    label: 'Intent Inline Chart',
    date: inlineChart.date,
    time: inlineChart.time,
    lat: inlineChart.lat,
    lon: inlineChart.lon,
    timezone: inlineChart.timezone,
  });
  return created.id;
}

/**
 * Compute compatibility intent response.
 * Intent only filters/ranks canonical field results; it never computes alternate compatibility logic.
 */
export async function computeCompatibilityIntent(
  request: CompatibilityIntentRequest
): Promise<CompatibilityIntentResponse> {
  const { seekerChartId, chart: inlineChart, intent, limit = 20, scope = 'global', groupId, seekerUserId } = request;

  if (scope === 'group' && !groupId) {
    throw new Error('groupId required when scope is group');
  }

  const seekerChartIdResolved = await resolveSeekerChartId(seekerChartId, inlineChart);
  const candidates = await getScopedCandidates(scope, groupId, seekerUserId);
  const scored: Array<{
    userId: string;
    chartId: string;
    displayName?: string;
    score: number;
    band: ClusterBand;
    explanationProfile: CompatibilityExplanationProfile;
  }> = [];
  for (const candidate of candidates) {
    if (candidate.chartId === seekerChartIdResolved) continue;
    const computed = await computeCompatibilitySystem({
      chartIds: [seekerChartIdResolved, candidate.chartId],
      relationshipBindingId: null,
    });
    const explanationBase = buildCompatibilityExplanationProfile({
      field: computed.field,
      scoring: computed.scoring,
      classification: computed.classification,
      intent,
    });
    const explanationProfile = await buildProjectedCompatibilityProfile(
      seekerChartIdResolved,
      candidate.chartId,
      intent,
      explanationBase,
      computed.field.object_identity_hash,
      computed.scoring
    );
    scored.push({
      ...candidate,
      score: canonicalIntentRank(computed.scoring, intent),
      band: assignBand(computed.scoring),
      explanationProfile,
    });
  }

  const bandOrder: ClusterBand[] = ['ease', 'spark', 'growth', 'complex'];
  const clusters: IntentCluster[] = bandOrder.map((band, idx) => {
    const membersForBand = scored
      .filter((s) => s.band === band)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.chartId.localeCompare(b.chartId);
      })
      .slice(0, Math.ceil((limit || 20) / 4));
    return {
      id: `cluster_${intent}_${idx}`,
      label: bandLabel(band),
      band,
      members: membersForBand.map((s) => ({
        userId: s.userId,
        chartId: s.chartId,
        displayName: s.displayName,
        descriptors: s.explanationProfile.primarySupports.slice(0, 2),
        sharedContext: [s.explanationProfile.intentFitSummary],
        explanationProfile: s.explanationProfile,
      })),
      why: {
        bullets: [
          membersForBand[0]?.explanationProfile.primarySupports[0],
          membersForBand[0]?.explanationProfile.tensionsOrLimits[0],
        ].filter((x): x is string => Boolean(x)),
      },
    };
  });

  return {
    intent,
    clusters: clusters.filter((c) => c.members.length > 0),
    meta: { scope, candidateCount: candidates.length },
  };
}
