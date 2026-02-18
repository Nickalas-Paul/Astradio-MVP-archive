/**
 * Compatibility intent API: POST /api/compatibility/intent
 * Curated clusters by domain bands. No ranked list; no percentages in response. Deterministic.
 */

import { generateArchitecture, type ChartInput } from '../core/architecture-engine';
import * as storage from '../compat/storage';
import type { Chart } from '../compat/types';
import { scoreCompatibility, type CompatMatchMode } from '../compat/matches';
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

const INTENT_TO_MODE: Record<IntentType, CompatMatchMode> = {
  friendship: 'friend',
  dating: 'lover',
  collaboration: 'friend',
  mentor: 'friend',
  roommate: 'friend',
  study: 'friend'
};

/** Map facet scores to narrative descriptors (no percentages). */
function descriptorsFromFacets(facets: { id: string; score: number }[]): string[] {
  const out: string[] = [];
  for (const f of facets) {
    if (f.score >= 0.7) out.push(`Strong ${f.id} alignment`);
    else if (f.score >= 0.5) out.push(`Moderate ${f.id} fit`);
    else out.push(`Different ${f.id} signature`);
  }
  return out;
}

/** Assign band from facet mix (deterministic). */
function assignBand(
  overall: number,
  elemental: number,
  tension: number,
  preference: number
): ClusterBand {
  if (elemental >= 0.7 && tension >= 0.6) return 'ease';
  if (preference >= 0.7) return 'spark';
  if (tension >= 0.5 && overall >= 0.5) return 'growth';
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

function chartToChartInput(chart: Chart): ChartInput {
  return { date: chart.date, time: chart.time, lat: chart.lat, lon: chart.lon, timezone: chart.timezone };
}

/**
 * Compute compatibility intent response: clustered candidates, no sorted scoreboard.
 * Uses architecture-engine for seeker and candidates. Deterministic.
 */
export async function computeCompatibilityIntent(
  request: CompatibilityIntentRequest
): Promise<CompatibilityIntentResponse> {
  const { seekerChartId, chart: inlineChart, intent, limit = 20, scope = 'global', groupId, seekerUserId, facets: _facets } = request;

  if (scope === 'group' && !groupId) {
    throw new Error('groupId required when scope is group');
  }

  let seekerVec: Float32Array | number[];
  let seekerChartIdResolved: string;

  if (seekerChartId) {
    const chart = storage.getChart(seekerChartId);
    if (!chart) throw new Error(`Chart not found: ${seekerChartId}`);
    const arch = await generateArchitecture(chartToChartInput(chart), seekerChartId);
    seekerVec = arch.features;
    seekerChartIdResolved = seekerChartId;
  } else if (inlineChart) {
    const arch = await generateArchitecture(inlineChart);
    seekerVec = arch.features;
    seekerChartIdResolved = 'inline';
  } else {
    throw new Error('Either seekerChartId or chart must be provided');
  }

  const mode = INTENT_TO_MODE[intent];
  const candidates = getScopedCandidates(scope, groupId, seekerUserId);
  const memberVecs: Array<{ userId: string; chartId: string; displayName?: string; vec: Float32Array | number[] }> = [];

  for (const cand of candidates) {
    const c = storage.getChart(cand.chartId);
    if (!c) continue;
    const arch = await generateArchitecture(chartToChartInput(c), cand.chartId);
    memberVecs.push({
      userId: cand.userId,
      chartId: cand.chartId,
      displayName: cand.displayName,
      vec: arch.features
    });
  }

  const scored = memberVecs.map((m) => {
    const { score, rationale, facets } = scoreCompatibility(seekerVec, m.vec, mode);
    const elemental = facets.find((f) => f.id === 'elemental')?.score ?? 0.5;
    const tension = facets.find((f) => f.id === 'tension')?.score ?? 0.5;
    const preference = facets.find((f) => f.id === 'preference')?.score ?? 0.5;
    const band = assignBand(score, elemental, tension, preference);
    return {
      ...m,
      score,
      rationale,
      facets,
      band
    };
  });

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
        descriptors: descriptorsFromFacets(s.facets),
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
