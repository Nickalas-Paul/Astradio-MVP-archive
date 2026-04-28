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
    scored.push({
      ...candidate,
      score: canonicalIntentRank(computed.scoring, intent),
      band: assignBand(computed.scoring),
      explanationProfile: buildCompatibilityExplanationProfile({
        field: computed.field,
        scoring: computed.scoring,
        classification: computed.classification,
        intent,
      }),
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
