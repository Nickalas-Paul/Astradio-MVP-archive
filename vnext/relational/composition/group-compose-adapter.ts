/**
 * Phase 5 — Group composition adapter.
 * Mandatory natal snapshot refetch per member chart (deterministic chart_id order) +
 * vector aggregation from stored vectors + unified aggregate compose runner.
 */

import * as crypto from 'crypto';
import { aggregateFeatureVectors } from '../../community/group-profile';
import { hashVector64 } from '../compatibility/score';
import { MissingVectorsError } from '../compatibility/multi-chart';
import { fetchChartSnapshot, type ChartInput } from '../../core/architecture-engine';
import { getChartById } from '../../compat/chart-store';

// Path from compiled dist/vnext/vnext/relational/composition/ -> repo root lib (5 levels up)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../../lib/vector-store');

import { vectorToControlPayload } from './vector-to-controls';
import { composeAPI } from '../../api/compose';

export const GROUP_COMPOSE_ALGORITHM_VERSION = 'group_compose_v2';

export interface GroupComposeProvenance {
  chart_ids: string[];
  vector_hashes: Record<string, string>;
  seed: string;
  algorithm_version: string;
}

export interface GroupComposeResult {
  provenance: GroupComposeProvenance;
  planHash: string;
  compositionId: string;
  audioBase64?: string;
  text?: unknown;
  /** Set when generateComposition=false — no runner, no Stage-4 artifact semantics */
  compose_skipped?: boolean;
}

function buildSeedForCharts(
  chartIds: string[],
  vectorHashes: Record<string, string>,
  groupId?: string
): string {
  const groupPart = groupId ? groupId : 'chartIds';
  const sortedChartIds = [...chartIds].sort((a, b) => a.localeCompare(b, 'en'));
  const sortedHashes = sortedChartIds.map((id) => vectorHashes[id] || '').sort();
  const payload = `${GROUP_COMPOSE_ALGORITHM_VERSION}|${groupPart}|${sortedChartIds.join(',')}|${sortedHashes.join(',')}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function chartToInput(chart: { date: string; time: string; lat: number; lon: number; timezone?: string }): ChartInput {
  return {
    date: chart.date,
    time: chart.time,
    lat: chart.lat,
    lon: chart.lon,
    timezone: chart.timezone,
  };
}

export async function composeGroupFromChartIds(
  chartIdsInput: string[],
  opts?: { groupId?: string; generateComposition?: boolean }
): Promise<GroupComposeResult> {
  const chart_ids = Array.from(new Set(chartIdsInput)).sort((a, b) => a.localeCompare(b, 'en'));
  if (chart_ids.length === 0) {
    throw new Error('chartIds required for group compose');
  }

  const vecMap: Map<
    string,
    { chartId: string; vector64: number[]; version: string; encoderVersion: string }
  > = await vectorStore.getChartVectorsByIds(chart_ids);

  const memberVectors: (Float32Array | number[])[] = [];
  const vectorHashes: Record<string, string> = {};
  const missing: string[] = [];

  for (const id of chart_ids) {
    const row = vecMap.get(id);
    if (!row || !Array.isArray(row.vector64) || row.vector64.length === 0) {
      missing.push(id);
      continue;
    }
    const vec = row.vector64 as number[];
    memberVectors.push(vec);
    vectorHashes[id] = hashVector64(vec);
  }

  if (missing.length > 0) {
    throw new MissingVectorsError(missing);
  }

  const snapshotsOrdered: import('../../contracts').EphemerisSnapshot[] = [];
  for (const id of chart_ids) {
    const chart = await getChartById(id);
    if (!chart) {
      throw new Error(`Chart not found for group compose: ${id}`);
    }
    const snap = await fetchChartSnapshot(chartToInput(chart));
    snapshotsOrdered.push(snap);
  }

  const composite = aggregateFeatureVectors(memberVectors, 'mean_normalized');
  const seed = buildSeedForCharts(chart_ids, vectorHashes, opts?.groupId);
  const payload = vectorToControlPayload(composite, seed);

  if (opts?.generateComposition === false) {
    return {
      provenance: {
        chart_ids,
        vector_hashes: vectorHashes,
        seed,
        algorithm_version: GROUP_COMPOSE_ALGORITHM_VERSION,
      },
      planHash: '',
      compositionId: '',
      compose_skipped: true,
    };
  }

  const anchorSnapshot = snapshotsOrdered[0];
  const result = await composeAPI.runAggregateComposition({
    kind: 'group',
    anchorSnapshot,
    snapshotsOrdered,
    composite: composite as import('../../contracts').FeatureVec,
    payload,
  });

  return {
    provenance: {
      chart_ids,
      vector_hashes: vectorHashes,
      seed,
      algorithm_version: GROUP_COMPOSE_ALGORITHM_VERSION,
    },
    planHash: result.planHash,
    compositionId: result.planHash,
    audioBase64: (result.audio as any)?.base64 || undefined,
    text: result.text,
  };
}
