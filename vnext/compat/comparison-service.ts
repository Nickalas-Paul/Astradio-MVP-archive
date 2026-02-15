/**
 * Community Compatibility V1 — comparison generation.
 * Uses existing encodeFeatures + mergeFeatureVectors + composeFromFeatures only.
 */

import type { EphemerisSnapshot } from '../contracts';
import { encodeFeatures } from '../feature-encode';
import { composeAPI } from '../api/compose';
import { mergeFeatureVectors } from './fusion';
import { controlPayloadFromSeed, comparisonSeed } from './payload-from-seed';
import * as storage from './storage';
import type { Chart, ChartBInline, Comparison, CompatibilityTextStructured, RelationshipMode } from './types';
import { FUSION_METHOD_BLEND_V1 } from './types';
import * as crypto from 'crypto';

const PORT = process.env.PORT || '3000';
const BASE_URL = process.env.COMPAT_CHART_BASE_URL || `http://localhost:${PORT}`;

async function fetchChartSnapshot(date: string, time: string, lat: number, lon: number): Promise<EphemerisSnapshot> {
  const t = time.length === 5 ? time : time.slice(0, 5);
  const q = new URLSearchParams({ date, time: t, lat: String(lat), lon: String(lon) });
  const r = await fetch(`${BASE_URL}/api/chart-snapshot?${q}`);
  if (!r.ok) throw new Error(`chart-snapshot failed: ${r.status}`);
  return r.json() as Promise<EphemerisSnapshot>;
}

function mergedFeatureHash(vec: Float32Array | number[]): string {
  const arr = Array.from(vec.length >= 64 ? vec : new Float32Array(64));
  const str = arr.map((x) => x.toFixed(6)).join(',');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Resolve chart B: either load by chartBId or create ephemeral chart from chartBInline (persist as Chart for simplicity).
 */
function resolveChartB(chartBId: string | undefined, chartBInline: ChartBInline | undefined): Chart {
  if (chartBId) {
    const c = storage.getChart(chartBId);
    if (!c) throw new Error(`Chart not found: ${chartBId}`);
    return c;
  }
  if (chartBInline && chartBInline.date && chartBInline.time && Number.isFinite(chartBInline.lat) && Number.isFinite(chartBInline.lon)) {
    return storage.createChart({
      label: chartBInline.label || 'Chart B',
      date: chartBInline.date,
      time: chartBInline.time,
      lat: chartBInline.lat,
      lon: chartBInline.lon,
      timezone: chartBInline.timezone
    });
  }
  throw new Error('Either chartBId or chartBInline (date, time, lat, lon) required');
}

export interface CreateComparisonInput {
  chartAId: string;
  chartBId?: string;
  chartBInline?: ChartBInline;
  relationshipMode: RelationshipMode;
  generateComposition?: boolean;
  fusion?: { wA: number; wB: number };
  createdBy?: string;
}

export interface CreateComparisonResult {
  comparison: Comparison;
  planHash: string;
  compositionId: string;
  audioBase64?: string;
  explanation?: { spec: string; sections: Array<{ title: string; text: string }> };
}

export async function createComparison(input: CreateComparisonInput): Promise<CreateComparisonResult> {
  const chartA = storage.getChart(input.chartAId);
  if (!chartA) throw new Error(`Chart not found: ${input.chartAId}`);
  const chartB = resolveChartB(input.chartBId, input.chartBInline);

  const snapA = await fetchChartSnapshot(chartA.date, chartA.time, chartA.lat, chartA.lon);
  const snapB = await fetchChartSnapshot(chartB.date, chartB.time, chartB.lat, chartB.lon);

  const vecA = encodeFeatures(snapA);
  const vecB = encodeFeatures(snapB);

  const wA = input.fusion?.wA ?? 0.5;
  const wB = input.fusion?.wB ?? 0.5;
  const merged = mergeFeatureVectors(vecA, vecB, {
    relationshipMode: input.relationshipMode,
    wA,
    wB
  });

  const seed = comparisonSeed(
    chartA.id,
    chartB.id,
    input.relationshipMode,
    FUSION_METHOD_BLEND_V1,
    wA,
    wB
  );
  const payload = controlPayloadFromSeed(seed);

  const result = await composeAPI.composeFromFeatures(merged as import('../contracts').FeatureVec, payload);

  const compatText: CompatibilityTextStructured = {
    short: (result.text as any)?.short ?? '',
    long: (result.text as any)?.long ?? '',
    bullets: Array.isArray((result.text as any)?.bullets) ? (result.text as any).bullets : []
  };

  const comparison = storage.createComparison({
    chartAId: chartA.id,
    chartBId: chartB.id,
    relationshipMode: input.relationshipMode,
    fusionMethod: FUSION_METHOD_BLEND_V1,
    fusionParams: { wA, wB },
    mergedFeatureVector64: Array.from(merged),
    mergedFeatureHash: mergedFeatureHash(merged),
    compatibilityText: compatText,
    planHash: result.planHash,
    compositionId: result.planHash,
    createdBy: input.createdBy
  });

  return {
    comparison,
    planHash: result.planHash,
    compositionId: result.planHash,
    audioBase64: result.audio?.base64 || undefined,
    explanation: result.explanation
  };
}
