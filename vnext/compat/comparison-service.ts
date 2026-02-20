/**
 * Community Compatibility V1 — comparison generation.
 * Uses architecture-engine (fetch once per chart, then generateArchitectureFromSnapshot) + mergeFeatureVectors + composeFromFeatures only.
 */

import { fetchChartSnapshot, generateArchitectureFromSnapshot, type ChartInput } from '../core/architecture-engine';
import { composeAPI } from '../api/compose';
import { mergeFeatureVectors } from './fusion';
import { controlPayloadFromSeed, comparisonSeed } from './payload-from-seed';
import { getChartById, resolveChartOrInline } from './chart-store';
import * as storage from './storage';
import type { Chart, ChartBInline, Comparison, CompatibilityTextStructured, RelationshipMode } from './types';
import { FUSION_METHOD_BLEND_V1 } from './types';
import * as crypto from 'crypto';

function chartToChartInput(chart: Chart): ChartInput {
  return { date: chart.date, time: chart.time, lat: chart.lat, lon: chart.lon, timezone: chart.timezone };
}

function mergedFeatureHash(vec: Float32Array | number[]): string {
  const arr = Array.from(vec.length >= 64 ? vec : new Float32Array(64));
  const str = arr.map((x) => x.toFixed(6)).join(',');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
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
  const chartA = await getChartById(input.chartAId);
  if (!chartA) throw new Error(`Chart not found: ${input.chartAId}`);
  if (!input.chartBId && !input.chartBInline) throw new Error('Either chartBId or chartBInline (date, time, lat, lon) required');
  const chartB = input.chartBId
    ? await getChartById(input.chartBId)
    : await resolveChartOrInline({ chartInline: input.chartBInline! });
  if (!chartB) throw new Error(`Chart not found: ${input.chartBId}`);

  // Single snapshot fetch per chart per request
  const [snapA, snapB] = await Promise.all([
    fetchChartSnapshot(chartToChartInput(chartA)),
    fetchChartSnapshot(chartToChartInput(chartB)),
  ]);
  const [archA, archB] = await Promise.all([
    generateArchitectureFromSnapshot(snapA),
    generateArchitectureFromSnapshot(snapB),
  ]);
  const vecA = archA.features;
  const vecB = archB.features;

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

  const comparison = await storage.createComparison({
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
