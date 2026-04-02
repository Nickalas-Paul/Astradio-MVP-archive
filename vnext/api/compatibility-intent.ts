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
import { getScopedCandidates } from './scope-resolver';

export type IntentType =
  | 'friendship'
  | 'dating'
  | 'collaboration'
  | 'mentor'
  | 'roommate'
  | 'study';

export type ScopeType = 'my_groups' | 'group' | 'global';

export interface CompatibilityIntentRequest {
  seekerChartId?: string;
  /** Inline chart when seekerChartId not provided */
  chart?: ChartInput;
  intent: IntentType;
  limit?: number;
  scope?: ScopeType;
  groupId?: string;
  seekerUserId?: string;
  facets?: {
    communication?: number;
    emotional?: number;
    growth?: number;
    creative?: number;
  };
}

export type ClusterBand = 'ease' | 'spark' | 'growth' | 'complex';

export interface IntentClusterMember {
  userId: string;
  chartId: string;
  displayName?: string;
  descriptors: string[];
  sharedContext?: string[];
}

export interface IntentCluster {
  id: string;
  label: string;
  band: ClusterBand;
  members: IntentClusterMember[];
  why: { bullets: string[] };
}

export interface CompatibilityIntentResponse {
  intent: IntentType;
  clusters: IntentCluster[];
  meta?: { scope: ScopeType; candidateCount: number };
}

const INTENT_WEIGHTS: Record<IntentType, { cohesion: number; tension: number; transformation: number; stability: number }> = {
  friendship: { cohesion: 0.4, tension: 0.1, transformation: 0.15, stability: 0.35 },
  dating: { cohesion: 0.3, tension: 0.1, transformation: 0.4, stability: 0.2 },
  collaboration: { cohesion: 0.35, tension: 0.15, transformation: 0.15, stability: 0.35 },
  mentor: { cohesion: 0.25, tension: 0.15, transformation: 0.4, stability: 0.2 },
  roommate: { cohesion: 0.3, tension: 0.1, transformation: 0.1, stability: 0.5 },
  study: { cohesion: 0.35, tension: 0.15, transformation: 0.15, stability: 0.35 },
};

function descriptorsFromScore(scoring: RelationalFieldScoreContract): string[] {
  const out: string[] = [];
  const parts = [
    ['cohesion', scoring.derived_indices.cohesion_index],
    ['tension', scoring.derived_indices.tension_index],
    ['transformation', scoring.derived_indices.transformation_index],
    ['stability', scoring.derived_indices.stability_index],
  ] as const;
  for (const [id, score] of parts) {
    if (score >= 0.7) out.push(`Strong ${id} signal`);
    else if (score >= 0.5) out.push(`Moderate ${id} signal`);
    else out.push(`Light ${id} signal`);
  }
  return out;
}

function rankForIntent(scoring: RelationalFieldScoreContract, intent: IntentType): number {
  const weights = INTENT_WEIGHTS[intent];
  return (
    scoring.derived_indices.cohesion_index * weights.cohesion +
    scoring.derived_indices.tension_index * weights.tension +
    scoring.derived_indices.transformation_index * weights.transformation +
    scoring.derived_indices.stability_index * weights.stability
  );
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
    case 'ease': return 'Easy conversation';
    case 'spark': return 'Creative spark';
    case 'growth': return 'Growth edge';
    case 'complex': return 'Complex blend';
    default: return 'Mixed';
  }
}

/** Why bullets for band (narrative, no numbers). */
function whyBullets(band: ClusterBand): string[] {
  switch (band) {
    case 'ease':
      return ['Elemental balance aligns', 'Conversation flows naturally'];
    case 'spark':
      return ['Shared preference space', 'Creative resonance'];
    case 'growth':
      return ['Tension invites growth', 'Complementary signatures'];
    case 'complex':
      return ['Mixed dynamics', 'Nuanced fit'];
    default:
      return ['Collective fit'];
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
  const { seekerChartId, chart: inlineChart, intent, limit = 20, scope = 'global', groupId, seekerUserId, facets: _facets } = request;

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
    scoring: RelationalFieldScoreContract;
    rationale: string;
  }> = [];
  for (const candidate of candidates) {
    if (candidate.chartId === seekerChartIdResolved) continue;
    const computed = await computeCompatibilitySystem({
      chartIds: [seekerChartIdResolved, candidate.chartId],
      relationshipBindingId: null,
    });
    scored.push({
      ...candidate,
      score: rankForIntent(computed.scoring, intent),
      band: assignBand(computed.scoring),
      scoring: computed.scoring,
      rationale: `Intent projection over canonical field ${computed.field.object_identity_hash.slice(0, 12)}.`,
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
        descriptors: descriptorsFromScore(s.scoring),
        sharedContext: [s.rationale]
      })),
      why: { bullets: whyBullets(band) }
    };
  });

  return {
    intent,
    clusters: clusters.filter((c) => c.members.length > 0),
    meta: { scope, candidateCount: candidates.length }
  };
}
