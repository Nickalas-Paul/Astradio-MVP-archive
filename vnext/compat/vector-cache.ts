/**
 * Phase 4 — Single write path for chart vectors.
 * Calls architecture-engine, persists to vector-store.
 * Primary generation: chart create/update and registration (awaited with retry).
 * Recovery: compat match pipeline may call populateChartVector once per request when vectors are missing (lazy backfill).
 */

import { generateArchitecture, type ChartInput } from '../core/architecture-engine';
import { getChartById } from './chart-store';
import type { Chart } from './types';

// Path from compiled dist/vnext/vnext/compat/ -> repo root lib
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vectorStore = require('../../../../lib/vector-store');

export const CHART_VECTOR_VERSION = 'v1';
export const CHART_VECTOR_ENCODER_VERSION = 'v1';

function chartToChartInput(chart: Chart): ChartInput {
  return {
    date: chart.date,
    time: chart.time,
    lat: chart.lat,
    lon: chart.lon,
    timezone: chart.timezone,
  };
}

/**
 * Populate stored vector for a chart. Single write path. Fetches chart, runs architecture-engine, upserts.
 * Only invoke from chart create/update or explicit population. Never from compat matches.
 * @param chartId
 * @param snapshotHash Optional snapshot hash for provenance
 * @returns { chartId, version } on success
 * @throws if chart not found or vector-store fails
 */
export async function populateChartVector(chartId: string, snapshotHash?: string): Promise<{ chartId: string; version: string }> {
  const chart = await getChartById(chartId);
  if (!chart) {
    throw new Error(`Chart not found: ${chartId}`);
  }

  const input = chartToChartInput(chart);
  const arch = await generateArchitecture(input, chartId);
  const vec = arch.features;
  const vector64 = Array.isArray(vec) ? (vec as number[]) : Array.from(vec as Float32Array);

  return vectorStore.upsertChartVector({
    chartId,
    vector64,
    version: CHART_VECTOR_VERSION,
    encoderVersion: CHART_VECTOR_ENCODER_VERSION,
    snapshotHash: snapshotHash ?? chart.snapshotHash ?? undefined,
  });
}
