/**
 * Stage 7 — Shared relational connection resolution for composite, forecast, and feed.
 * Same chart ordering, vectors, natal snapshots, and control payload as group compose (without running the runner).
 */

import * as crypto from 'crypto';
import { aggregateFeatureVectors } from '../community/group-profile';
import { hashVector64 } from './compatibility/score';
import { MissingVectorsError } from './compatibility/multi-chart';
import { fetchChartSnapshot, type ChartInput } from '../core/architecture-engine';
import { getChartById } from '../compat/chart-store';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ControlSurfacePayload } from '../explainer/contracts';
import { vectorToControlPayload } from './composition/vector-to-controls';

// eslint-disable-next-line @typescript-eslint/no-var-requires
/** Resolves from compiled dist/vnext/vnext/relational/ → repo root (four levels up). */
const vectorStore = require('../../../../lib/vector-store');

export const GROUP_COMPOSE_ALGORITHM_VERSION = 'group_compose_v2';

export interface RelationalConnectionProvenanceV1 {
  chart_ids: string[];
  vector_hashes: Record<string, string>;
  seed: string;
  algorithm_version: string;
}

export interface RelationalConnectionContextV1 {
  chartIdsOrdered: string[];
  natalSnapshotsOrdered: EphemerisSnapshot[];
  composite: FeatureVec;
  payload: ControlSurfacePayload;
  provenance: RelationalConnectionProvenanceV1;
}

function buildSeedForCharts(chartIds: string[], vectorHashes: Record<string, string>, bindingKey?: string): string {
  const groupPart = bindingKey ?? 'chartIds';
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

/**
 * Resolve sorted chart IDs to natal snapshots, composite vector, and control payload.
 * @param bindingKey — relationship id or group id for seed stability (same as prior group-compose-adapter behavior).
 */
export async function resolveRelationalConnectionFromChartIds(
  chartIdsInput: string[],
  bindingKey?: string
): Promise<RelationalConnectionContextV1> {
  const chartIdsOrdered = Array.from(new Set(chartIdsInput)).sort((a, b) => a.localeCompare(b, 'en'));
  if (chartIdsOrdered.length === 0) {
    throw new Error('chartIds required for relational connection resolution');
  }

  const vecMap: Map<string, { chartId: string; vector64: number[]; version: string; encoderVersion: string }> =
    await vectorStore.getChartVectorsByIds(chartIdsOrdered);

  const memberVectors: (Float32Array | number[])[] = [];
  const vectorHashes: Record<string, string> = {};
  const missing: string[] = [];

  for (const id of chartIdsOrdered) {
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

  const natalSnapshotsOrdered: EphemerisSnapshot[] = [];
  for (const id of chartIdsOrdered) {
    const chart = await getChartById(id);
    if (!chart) {
      throw new Error(`Chart not found for relational connection: ${id}`);
    }
    const snap = await fetchChartSnapshot(chartToInput(chart));
    natalSnapshotsOrdered.push(snap);
  }

  const composite = aggregateFeatureVectors(memberVectors, 'mean_normalized') as FeatureVec;
  const seed = buildSeedForCharts(chartIdsOrdered, vectorHashes, bindingKey);
  const payload = vectorToControlPayload(composite, seed);

  return {
    chartIdsOrdered,
    natalSnapshotsOrdered,
    composite,
    payload,
    provenance: {
      chart_ids: chartIdsOrdered,
      vector_hashes: vectorHashes,
      seed,
      algorithm_version: GROUP_COMPOSE_ALGORITHM_VERSION,
    },
  };
}
