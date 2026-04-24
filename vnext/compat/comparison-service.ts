/**
 * Community Compatibility V1 — comparison generation.
 * Architecture-engine per chart + mergeFeatureVectors + unified aggregate compose runner.
 */

import { fetchChartSnapshot, generateArchitectureFromSnapshot, type ChartInput } from '../core/architecture-engine';
import { composeAPI } from '../api/compose';
import { mergeFeatureVectors } from './fusion';
import { controlPayloadFromSeed, comparisonSeed } from './payload-from-seed';
import { getChartById, resolveChartOrInline } from './chart-store';
import * as storage from './storage';
import type { Chart, ChartBInline, Comparison, CompatibilityTextStructured, RelationshipMode } from './types';
import { FUSION_METHOD_BLEND_V1 } from './types';
import type { ExpansionTier } from '../projection/projection-types';
import * as crypto from 'crypto';
import { computeCompatibilitySystem } from '../compatibility/service';

const COMPOSE_SKIPPED_SENTINEL = '__compose_skipped__';

export function parseExpansionTier(v: unknown): ExpansionTier {
  if (v === 'expanded' || v === 'extended') return v;
  return 'baseline';
}
export const COMPARISON_COMPOSE_ALGORITHM_VERSION = 'comparison_compose_v2';

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
  expansionTier?: ExpansionTier;
}

export interface CreateComparisonResult {
  comparison: Comparison;
  planHash: string;
  compositionId: string;
  /** Lyria/export store key when aggregate compose produced a durable WAV (same contract as GET /api/exports/:id). */
  exportId?: string | null;
  audioBase64?: string;
  explanation?: {
    spec: string;
    sections: Array<{
      sectionId: string;
      title: string;
      text?: string;
      bullets?: string[];
      meta?: Record<string, unknown>;
    }>;
    meta?: Record<string, unknown>;
  };
  /** False when generateComposition=false: no canonical aggregate reading was produced (metadata-only path). */
  semantic_reading_available: boolean;
}

export async function createComparison(input: CreateComparisonInput): Promise<CreateComparisonResult> {
  const chartA = await getChartById(input.chartAId);
  if (!chartA) throw new Error(`Chart not found: ${input.chartAId}`);
  if (!input.chartBId && !input.chartBInline) throw new Error('Either chartBId or chartBInline (date, time, lat, lon) required');
  const chartB = input.chartBId
    ? await getChartById(input.chartBId)
    : await resolveChartOrInline({ chartInline: input.chartBInline! });
  if (!chartB) throw new Error(`Chart not found: ${input.chartBId}`);

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
    wB,
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

  const genCompose = input.generateComposition !== false;
  const compatibility = await computeCompatibilitySystem({
    chartIds: [chartA.id, chartB.id],
    relationshipBindingId: null,
  });

  if (!genCompose) {
    const compatText: CompatibilityTextStructured = { short: '', long: '', bullets: [] };
    const comparison = await storage.createComparison({
      chartAId: chartA.id,
      chartBId: chartB.id,
      seekerChartId: chartA.id,
      targetChartId: chartB.id,
      relationshipMode: input.relationshipMode,
      fusionMethod: FUSION_METHOD_BLEND_V1,
      fusionParams: {
        wA,
        wB,
        compose_algorithm_version: COMPARISON_COMPOSE_ALGORITHM_VERSION,
        compose_skipped: true,
      },
      mergedFeatureVector64: Array.from(merged),
      mergedFeatureHash: mergedFeatureHash(merged),
      compatibilityText: compatText,
      planHash: COMPOSE_SKIPPED_SENTINEL,
      compositionId: COMPOSE_SKIPPED_SENTINEL,
      createdBy: input.createdBy,
      compatibilityFieldHash: compatibility.field.object_identity_hash,
      compatibilityRecord: compatibility.record,
      compatibilityField: compatibility.field,
      scoring: compatibility.scoring,
      classification: compatibility.classification,
    });
    return {
      comparison,
      planHash: '',
      compositionId: '',
      semantic_reading_available: false,
    };
  }

  const idLow = chartA.id.localeCompare(chartB.id, 'en') <= 0 ? chartA.id : chartB.id;
  const idHigh = chartA.id.localeCompare(chartB.id, 'en') <= 0 ? chartB.id : chartA.id;
  const snapLow = idLow === chartA.id ? snapA : snapB;
  const snapHigh = idHigh === chartA.id ? snapA : snapB;
  const vecLow = idLow === chartA.id ? vecA : vecB;
  const vecHigh = idHigh === chartA.id ? vecA : vecB;

  const result = await composeAPI.runAggregateComposition({
    kind: 'comparison',
    chartIdLow: idLow,
    chartIdHigh: idHigh,
    snapLow,
    snapHigh,
    vecLow: vecLow as import('../contracts').FeatureVec,
    vecHigh: vecHigh as import('../contracts').FeatureVec,
    merged: merged as import('../contracts').FeatureVec,
    payload,
    relationshipMode: input.relationshipMode,
    expansionTier: parseExpansionTier(input.expansionTier),
  });

  const compatText: CompatibilityTextStructured = {
    short: (result.text as any)?.short ?? '',
    long: (result.text as any)?.long ?? '',
    bullets: Array.isArray((result.text as any)?.bullets) ? (result.text as any).bullets : [],
  };

  const comparison = await storage.createComparison({
    chartAId: chartA.id,
    chartBId: chartB.id,
    seekerChartId: chartA.id,
    targetChartId: chartB.id,
    relationshipMode: input.relationshipMode,
    fusionMethod: FUSION_METHOD_BLEND_V1,
    fusionParams: { wA, wB, compose_algorithm_version: COMPARISON_COMPOSE_ALGORITHM_VERSION },
    mergedFeatureVector64: Array.from(merged),
    mergedFeatureHash: mergedFeatureHash(merged),
    compatibilityText: compatText,
    planHash: result.planHash,
    compositionId: result.planHash,
    createdBy: input.createdBy,
    compatibilityFieldHash: compatibility.field.object_identity_hash,
    compatibilityRecord: compatibility.record,
    compatibilityField: compatibility.field,
    scoring: compatibility.scoring,
    classification: compatibility.classification,
  });

  return {
    comparison,
    planHash: result.planHash,
    compositionId: result.planHash,
    exportId: result.export_id ?? null,
    audioBase64: result.audio?.base64 || undefined,
    explanation: result.explanation,
    semantic_reading_available: true,
  };
}
