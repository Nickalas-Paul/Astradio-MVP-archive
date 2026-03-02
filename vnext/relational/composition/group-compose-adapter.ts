/**
 * Phase 5 — Group composition adapter.
 * Uses stored vectors only; aggregates via aggregateFeatureVectors; calls composeAPI.composeFromFeatures.
 * Deterministic: member vectors ordered by chart_id ASC; seed derived from group/chartIds + vector hashes.
 */

import * as crypto from 'crypto';
import { aggregateFeatureVectors } from '../../community/group-profile';
import { hashVector64 } from '../compatibility/score';
import { MissingVectorsError } from '../compatibility/multi-chart';

// Path from compiled dist/vnext/vnext/relational/composition/ -> repo root lib (5 levels up)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../../lib/vector-store');

import { vectorToControlPayload } from './vector-to-controls';
import { composeAPI } from '../../api/compose';

const ALGORITHM_VERSION = 'group_compose_v1';

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export interface GroupComposeProvenance {
  chart_ids: string[];
  vector_hashes: Record<string, string>;
  seed: string;
  algorithm_version: string;
}

export interface GroupComposeResult {
  provenance: GroupComposeProvenance;
  // Plan / audio hashes as returned by composeFromFeatures
  planHash: string;
  // compositionId mirrors planHash for now
  compositionId: string;
  audioBase64?: string;
  text?: unknown;
}

function buildSeedForCharts(
  chartIds: string[],
  vectorHashes: Record<string, string>,
  groupId?: string
): string {
  const groupPart = groupId ? groupId : 'chartIds';
  const sortedChartIds = [...chartIds].sort((a, b) => a.localeCompare(b, 'en'));
  const sortedHashes = sortedChartIds
    .map((id) => vectorHashes[id] || '')
    .sort();
  const payload = `${ALGORITHM_VERSION}|${groupPart}|${sortedChartIds.join(
    ','
  )}|${sortedHashes.join(',')}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

export async function composeGroupFromChartIds(
  chartIdsInput: string[],
  opts?: { groupId?: string }
): Promise<GroupComposeResult> {
  const chart_ids = Array.from(new Set(chartIdsInput)).sort((a, b) =>
    a.localeCompare(b, 'en')
  );
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

  const composite = aggregateFeatureVectors(memberVectors, 'mean_normalized');
  const seed = buildSeedForCharts(chart_ids, vectorHashes, opts?.groupId);
  const payload = vectorToControlPayload(composite, seed);

  const result = await composeAPI.composeFromFeatures(
    composite as import('../../contracts').FeatureVec,
    payload
  );

  return {
    provenance: {
      chart_ids,
      vector_hashes: vectorHashes,
      seed,
      algorithm_version: ALGORITHM_VERSION,
    },
    planHash: result.planHash,
    compositionId: result.planHash,
    audioBase64: (result.audio as any)?.base64 || undefined,
    text: result.text,
  };
}

