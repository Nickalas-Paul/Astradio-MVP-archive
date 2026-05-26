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
import type { CompatibilityComputationResult } from '../compatibility/service';
import type { AggregateComposeResult } from '../api/compose';

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
  /** Default true. When false, compose runs but no astradio_comparisons row is written (forecast cache path). */
  persist?: boolean;
  /** Pair forecast: scope compatibility scoring to relationship binding; omit for standalone comparisons. */
  relationshipBindingId?: string | null;
}

export interface CreateComparisonResult {
  comparison?: Comparison;
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

/**
 * Shared ML path for comparison aggregates — architecture + fusion + seed/payload + compat scoring + runAggregateComposition.
 * Phase 6D: omits relationalWeather on compose for strict parity with saved comparisons (Decision 1).
 */
export interface ComposeComparisonAggregateReadingParams {
  chartAId: string;
  chartBId: string;
  relationshipMode: RelationshipMode;
  seekerChartId: string;
  targetChartId: string;
  relationshipBindingId?: string | null;
  fusion?: { wA: number; wB: number };
  expansionTier?: ExpansionTier;
  /** When true, run Lyria export during aggregate compose (feed audio opt-in). */
  generateAudio?: boolean;
}

export interface ComposeComparisonAggregateReadingResult {
  chartA: Chart;
  chartB: Chart;
  merged: Float32Array | number[];
  compatibility: CompatibilityComputationResult;
  compose: AggregateComposeResult;
}

export async function composeComparisonAggregateReading(
  params: ComposeComparisonAggregateReadingParams
): Promise<ComposeComparisonAggregateReadingResult> {
  const chartA = await getChartById(params.chartAId);
  if (!chartA) throw new Error(`Chart not found: ${params.chartAId}`);
  const chartB = await getChartById(params.chartBId);
  if (!chartB) throw new Error(`Chart not found: ${params.chartBId}`);

  const seek = String(params.seekerChartId || '').trim();
  const tgt = String(params.targetChartId || '').trim();
  if (!seek || !tgt || seek === tgt) throw new Error('seekerChartId and targetChartId required');
  if (seek !== chartA.id || tgt !== chartB.id) {
    throw new Error('composeComparisonAggregateReading: seeker/target must match chartA/chartB ids');
  }

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

  const wA = params.fusion?.wA ?? 0.5;
  const wB = params.fusion?.wB ?? 0.5;
  const merged = mergeFeatureVectors(vecA, vecB, {
    relationshipMode: params.relationshipMode,
    wA,
    wB,
  });

  const seed = comparisonSeed(chartA.id, chartB.id, params.relationshipMode, FUSION_METHOD_BLEND_V1, wA, wB);
  const payload = controlPayloadFromSeed(seed);

  const compatibility = await computeCompatibilitySystem({
    chartIds: [chartA.id, chartB.id].sort((a, b) => a.localeCompare(b, 'en')),
    relationshipBindingId: params.relationshipBindingId ?? null,
  });

  const idLow = chartA.id.localeCompare(chartB.id, 'en') <= 0 ? chartA.id : chartB.id;
  const idHigh = chartA.id.localeCompare(chartB.id, 'en') <= 0 ? chartB.id : chartA.id;
  const snapLow = idLow === chartA.id ? snapA : snapB;
  const snapHigh = idHigh === chartA.id ? snapA : snapB;
  const vecLow = idLow === chartA.id ? vecA : vecB;
  const vecHigh = idHigh === chartA.id ? vecA : vecB;

  const compose = await composeAPI.runAggregateComposition({
    kind: 'comparison',
    chartIdLow: idLow,
    chartIdHigh: idHigh,
    snapLow,
    snapHigh,
    vecLow: vecLow as import('../contracts').FeatureVec,
    vecHigh: vecHigh as import('../contracts').FeatureVec,
    merged: merged as import('../contracts').FeatureVec,
    payload,
    compatClassCode: compatibility.classification.outputs.class_code,
    relationshipMode: params.relationshipMode,
    expansionTier: parseExpansionTier(params.expansionTier),
    seekerChartId: chartA.id,
    targetChartId: chartB.id,
    generateAudio: params.generateAudio === true,
  });

  return { chartA, chartB, merged, compatibility, compose };
}

export async function createComparison(input: CreateComparisonInput): Promise<CreateComparisonResult> {
  const chartA = await getChartById(input.chartAId);
  if (!chartA) throw new Error(`Chart not found: ${input.chartAId}`);
  if (!input.chartBId && !input.chartBInline) throw new Error('Either chartBId or chartBInline (date, time, lat, lon) required');
  const chartB = input.chartBId
    ? await getChartById(input.chartBId)
    : await resolveChartOrInline({ chartInline: input.chartBInline! });
  if (!chartB) throw new Error(`Chart not found: ${input.chartBId}`);

  const wA = input.fusion?.wA ?? 0.5;
  const wB = input.fusion?.wB ?? 0.5;
  const genCompose = input.generateComposition !== false;

  if (!genCompose) {
    const [snapA, snapB] = await Promise.all([
      fetchChartSnapshot(chartToChartInput(chartA)),
      fetchChartSnapshot(chartToChartInput(chartB)),
    ]);
    const [archA, archB] = await Promise.all([
      generateArchitectureFromSnapshot(snapA),
      generateArchitectureFromSnapshot(snapB),
    ]);
    const merged = mergeFeatureVectors(archA.features, archB.features, {
      relationshipMode: input.relationshipMode,
      wA,
      wB,
    });
    const compatibility = await computeCompatibilitySystem({
      chartIds: [chartA.id, chartB.id].sort((a, b) => a.localeCompare(b, 'en')),
      relationshipBindingId: input.relationshipBindingId ?? null,
    });
    const compatText: CompatibilityTextStructured = { short: '', long: '', bullets: [] };
    const persist = input.persist !== false;
    let comparison: Comparison | undefined;
    if (persist) {
      comparison = await storage.createComparison({
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
    }
    return {
      comparison,
      planHash: '',
      compositionId: '',
      semantic_reading_available: false,
    };
  }

  const core = await composeComparisonAggregateReading({
    chartAId: chartA.id,
    chartBId: chartB.id,
    relationshipMode: input.relationshipMode,
    seekerChartId: chartA.id,
    targetChartId: chartB.id,
    relationshipBindingId: input.relationshipBindingId ?? null,
    fusion: input.fusion,
    expansionTier: input.expansionTier,
  });

  const result = core.compose;
  const merged = core.merged;
  const compatibility = core.compatibility;

  const compatText: CompatibilityTextStructured = {
    short: (result.text as any)?.short ?? '',
    long: (result.text as any)?.long ?? '',
    bullets: Array.isArray((result.text as any)?.bullets) ? (result.text as any).bullets : [],
  };

  const persist = input.persist !== false;
  let comparison: Comparison | undefined;
  if (persist) {
    comparison = await storage.createComparison({
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
  }

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
