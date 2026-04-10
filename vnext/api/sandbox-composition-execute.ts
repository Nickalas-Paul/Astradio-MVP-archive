/**
 * Sandbox composition resolve — normalization + routing to existing compose / aggregate only.
 * Per-slot: natal + overrides → overridden EphemerisSnapshot (LOCK 1–2). Sandbox group: no vector_store (LOCK 3).
 */

import * as crypto from 'crypto';
import type { ComposeRequest, ComposeResponse } from '../explainer/contracts';
import type { EphemerisSnapshot, SandboxBirth, SandboxOverrides } from '../contracts';
import { composeAPI, type AggregateComposeResult } from './compose';
import {
  normalizeCompositionInput,
  type SandboxCompositionInputV1,
  type NormalizedCompositionSuccess,
  type SandboxSlotResolution,
  SANDBOX_COMPOSITION_ERROR_CODES,
} from './sandbox-composition-normalize';
import { generateSnapshotWithOverrides, hashBirth, hashOverrides } from './sandbox-snapshot';
import { fetchChartSnapshot, type ChartInput } from '../core/architecture-engine';
import { getChartById } from '../compat/chart-store';
import type { Chart } from '../compat/types';
import { mergeFeatureVectors } from '../compat/fusion';
import { controlPayloadFromSeed, comparisonSeed } from '../compat/payload-from-seed';
import { FUSION_METHOD_BLEND_V1 } from '../compat/types';
import type { RelationshipMode } from '../compat/types';
import type { FeatureVec } from '../contracts';
import { aggregateFeatureVectors } from '../community/group-profile';
import { hashVector64 } from '../relational/compatibility/score';
import { vectorToControlPayload } from '../relational/composition/vector-to-controls';

const SANDBOX_GROUP_SEED_VERSION = 'sandbox_group_v3';

export const SANDBOX_RESOLVE_ERROR_CODES = {
  ...SANDBOX_COMPOSITION_ERROR_CODES,
  CHART_NOT_FOUND: 'chart_not_found',
  MISSING_STORED_VECTORS: 'missing_stored_vectors',
  EXECUTION_FAILED: 'execution_failed',
} as const;

export type SandboxResolveSuccess = {
  ok: true;
  composition_mode: NormalizedCompositionSuccess['composition_mode'];
  canonical_slot_order: string[];
  canonical_input_hash: string;
  canonical_input_hash_version: number;
  output_kind: NormalizedCompositionSuccess['output_kind'];
  compose?: ComposeResponse;
  aggregate?: AggregateComposeResult;
};

export type SandboxResolveFailure = {
  ok: false;
  code: string;
  message: string;
  status: number;
};

export type SandboxResolveResult = SandboxResolveSuccess | SandboxResolveFailure;

function chartToChartInput(chart: Chart): ChartInput {
  return { date: chart.date, time: chart.time, lat: chart.lat, lon: chart.lon, timezone: chart.timezone };
}

function combinedBirthOverridesHash(birth: SandboxBirth, overrides: SandboxOverrides): string {
  const bh = hashBirth(birth);
  const oh = hashOverrides(overrides);
  return crypto.createHash('sha256').update(bh + oh, 'utf8').digest('hex');
}

function combinedChartIdOverridesHash(chartId: string, overrides: SandboxOverrides): string {
  const oh = hashOverrides(overrides);
  return crypto.createHash('sha256').update(`${chartId}|${oh}`, 'utf8').digest('hex');
}

function slotIdentityForComparisonSeed(r: SandboxSlotResolution): string {
  if (r.chart_id) {
    return `chart:${r.chart_id}|ov:${hashOverrides(r.overrides)}`;
  }
  return `birth:${hashBirth(r.birth!)}|ov:${hashOverrides(r.overrides)}`;
}

function buildSandboxGroupSeed(
  slotIdentityTokensUiOrder: string[],
  vectorHashesUiOrder: string[],
  bindingKey?: string
): string {
  const groupPart = bindingKey ?? 'sandbox_group';
  const payload = `${SANDBOX_GROUP_SEED_VERSION}|${groupPart}|${slotIdentityTokensUiOrder.join('\x1e')}|${vectorHashesUiOrder.join('\x1e')}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Canonical per-slot resolver: natal → overridden EphemerisSnapshot (LOCK 1–2).
 */
export async function resolveSandboxSlotToOverriddenSnapshot(r: SandboxSlotResolution): Promise<EphemerisSnapshot> {
  const overrides = r.overrides || { planets: {} };
  let natal: EphemerisSnapshot;
  if (r.chart_id) {
    const chart = await getChartById(r.chart_id);
    if (!chart) {
      throw Object.assign(new Error(`Chart not found: ${r.chart_id}`), { code: SANDBOX_RESOLVE_ERROR_CODES.CHART_NOT_FOUND });
    }
    natal = await fetchChartSnapshot(chartToChartInput(chart));
  } else if (r.birth) {
    natal = await fetchChartSnapshot({
      date: r.birth.date,
      time: r.birth.time.length === 5 ? r.birth.time : r.birth.time.slice(0, 5),
      lat: r.birth.lat,
      lon: r.birth.lon,
      timezone: r.birth.tz,
    });
  } else {
    throw new Error('resolveSandboxSlotToOverriddenSnapshot: empty slot resolution');
  }
  return generateSnapshotWithOverrides(natal, overrides);
}

function populatedResolutionsInUiOrder(normalized: NormalizedCompositionSuccess): SandboxSlotResolution[] {
  const withContent = normalized.slot_resolutions.filter((r) => r.chart_id || r.birth);
  return [...withContent].sort((a, b) => a.ui_index - b.ui_index);
}

function isChartNotFoundErr(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e as Error & { code?: string }).code === SANDBOX_RESOLVE_ERROR_CODES.CHART_NOT_FOUND
  );
}

/**
 * Resolve sandbox composition through canonical pipeline only.
 */
export async function executeSandboxComposition(body: unknown): Promise<SandboxResolveResult> {
  const input = body as SandboxCompositionInputV1;
  const normalized = normalizeCompositionInput(input);
  if (!normalized.ok) {
    const status =
      normalized.code === SANDBOX_COMPOSITION_ERROR_CODES.NO_POPULATED_SLOTS ||
      normalized.code === SANDBOX_COMPOSITION_ERROR_CODES.INVALID_BODY
        ? 400
        : 422;
    return { ok: false, code: normalized.code, message: normalized.message, status };
  }

  const output_kind = normalized.output_kind;

  try {
    if (normalized.composition_mode === 'single') {
      const r = normalized.slot_resolutions.find((x) => x.chart_id || x.birth)!;
      let composeReq: ComposeRequest;

      if (r.chart_id) {
        const overridden = await resolveSandboxSlotToOverriddenSnapshot(r);
        const seedFallback = combinedChartIdOverridesHash(r.chart_id, r.overrides);
        composeReq = {
          mode: 'sandbox',
          overriddenSnapshot: overridden,
          controls: normalized.compose_controls as ComposeRequest['controls'],
          seed: normalized.seed && normalized.seed.length > 0 ? normalized.seed : seedFallback,
          output_kind,
          generateAudio: true,
        };
      } else if (r.birth) {
        const overridden = await resolveSandboxSlotToOverriddenSnapshot(r);
        const ch = combinedBirthOverridesHash(r.birth, r.overrides);
        composeReq = {
          mode: 'sandbox',
          overriddenSnapshot: overridden,
          controls: normalized.compose_controls as ComposeRequest['controls'],
          seed: normalized.seed && normalized.seed.length > 0 ? normalized.seed : ch,
          output_kind,
          generateAudio: true,
        };
      } else {
        return {
          ok: false,
          code: SANDBOX_RESOLVE_ERROR_CODES.EXECUTION_FAILED,
          message: 'single mode: empty slot resolution',
          status: 500,
        };
      }

      const compose = await composeAPI.compose(composeReq);
      return {
        ok: true,
        composition_mode: 'single',
        canonical_slot_order: normalized.canonical_slot_order,
        canonical_input_hash: normalized.canonical_input_hash,
        canonical_input_hash_version: normalized.canonical_input_hash_version,
        output_kind,
        compose,
      };
    }

    if (normalized.composition_mode === 'overlay') {
      const tc = normalized.transit_context!;
      const populated = populatedResolutionsInUiOrder(normalized);
      const natalOverridden = await resolveSandboxSlotToOverriddenSnapshot(populated[0]);
      const natalChart = await getChartById(tc.natal_chart_id);
      if (!natalChart) {
        return {
          ok: false,
          code: SANDBOX_RESOLVE_ERROR_CODES.CHART_NOT_FOUND,
          message: `Natal chart not found: ${tc.natal_chart_id}`,
          status: 404,
        };
      }
      const natalTz =
        typeof natalChart.timezone === 'string' && natalChart.timezone.trim() ? natalChart.timezone.trim() : undefined;
      const curTz =
        typeof tc.current_timezone === 'string' && tc.current_timezone.trim() ? tc.current_timezone.trim() : undefined;
      const composeReq: ComposeRequest = {
        mode: 'overlay',
        overlayParams: {
          natalLatitude: natalOverridden.lat,
          natalLongitude: natalOverridden.lon,
          natalDatetime: natalOverridden.ts,
          ...(natalTz ? { natalTimezone: natalTz } : {}),
          currentLatitude: tc.current_latitude,
          currentLongitude: tc.current_longitude,
          currentDatetime: tc.current_datetime,
          ...(curTz ? { currentTimezone: curTz } : {}),
        },
        controls: normalized.compose_controls as ComposeRequest['controls'],
        seed: normalized.seed,
        output_kind,
        generateAudio: true,
      };
      const compose = await composeAPI.compose(composeReq);
      return {
        ok: true,
        composition_mode: 'overlay',
        canonical_slot_order: normalized.canonical_slot_order,
        canonical_input_hash: normalized.canonical_input_hash,
        canonical_input_hash_version: normalized.canonical_input_hash_version,
        output_kind,
        compose,
      };
    }

    if (normalized.composition_mode === 'pair_aggregate') {
      const populated = populatedResolutionsInUiOrder(normalized);
      const rA = populated[0];
      const rB = populated[1];
      let snapLow: EphemerisSnapshot;
      let snapHigh: EphemerisSnapshot;
      try {
        ;[snapLow, snapHigh] = await Promise.all([
          resolveSandboxSlotToOverriddenSnapshot(rA),
          resolveSandboxSlotToOverriddenSnapshot(rB),
        ]);
      } catch (e) {
        if (isChartNotFoundErr(e)) {
          return {
            ok: false,
            code: SANDBOX_RESOLVE_ERROR_CODES.CHART_NOT_FOUND,
            message: e instanceof Error ? e.message : 'Chart not found',
            status: 404,
          };
        }
        throw e;
      }

      const { generateArchitectureFromSnapshot } = await import('../core/architecture-engine');
      const [archLow, archHigh] = await Promise.all([
        generateArchitectureFromSnapshot(snapLow),
        generateArchitectureFromSnapshot(snapHigh),
      ]);
      const vecLow = archLow.features;
      const vecHigh = archHigh.features;
      const wA = 0.5;
      const wB = 0.5;
      const relationshipMode: RelationshipMode =
        (input.binding?.relationship_mode as RelationshipMode) || 'neutral';
      const merged = mergeFeatureVectors(vecLow, vecHigh, {
        relationshipMode,
        wA,
        wB,
      });
      const idA = slotIdentityForComparisonSeed(rA);
      const idB = slotIdentityForComparisonSeed(rB);
      const seed = comparisonSeed(idA, idB, relationshipMode, FUSION_METHOD_BLEND_V1, wA, wB);
      const payload = controlPayloadFromSeed(seed);

      const aggregate = await composeAPI.runAggregateComposition({
        kind: 'comparison',
        chartIdLow: idA,
        chartIdHigh: idB,
        snapLow,
        snapHigh,
        vecLow: vecLow as FeatureVec,
        vecHigh: vecHigh as FeatureVec,
        merged: merged as FeatureVec,
        payload,
        relationshipMode,
        output_kind,
      });

      return {
        ok: true,
        composition_mode: 'pair_aggregate',
        canonical_slot_order: normalized.canonical_slot_order,
        canonical_input_hash: normalized.canonical_input_hash,
        canonical_input_hash_version: normalized.canonical_input_hash_version,
        output_kind,
        aggregate,
      };
    }

    if (normalized.composition_mode === 'group_aggregate') {
      const populated = populatedResolutionsInUiOrder(normalized);
      let overriddenSnaps: EphemerisSnapshot[];
      try {
        overriddenSnaps = await Promise.all(populated.map((r) => resolveSandboxSlotToOverriddenSnapshot(r)));
      } catch (e) {
        if (isChartNotFoundErr(e)) {
          return {
            ok: false,
            code: SANDBOX_RESOLVE_ERROR_CODES.CHART_NOT_FOUND,
            message: e instanceof Error ? e.message : 'Chart not found',
            status: 404,
          };
        }
        throw e;
      }

      const { generateArchitectureFromSnapshot } = await import('../core/architecture-engine');
      const archs = await Promise.all(
        overriddenSnaps.map((sn) => generateArchitectureFromSnapshot(sn)),
      );
      const memberVecs = archs.map((a) => a.features as Float32Array | number[]);
      const composite = aggregateFeatureVectors(memberVecs, 'mean_normalized') as FeatureVec;

      const slotTokens = populated.map((r) => slotIdentityForComparisonSeed(r));
      const vectorHashesUi = memberVecs.map((v) => hashVector64(v));
      const groupSeed = buildSandboxGroupSeed(slotTokens, vectorHashesUi, input.binding?.group_id);
      const payload = vectorToControlPayload(composite, groupSeed);

      const aggregate = await composeAPI.runAggregateComposition({
        kind: 'group',
        anchorSnapshot: overriddenSnaps[0],
        snapshotsOrdered: overriddenSnaps,
        memberFeatureVecs: memberVecs as FeatureVec[],
        composite,
        payload,
        output_kind,
      });

      return {
        ok: true,
        composition_mode: 'group_aggregate',
        canonical_slot_order: normalized.canonical_slot_order,
        canonical_input_hash: normalized.canonical_input_hash,
        canonical_input_hash_version: normalized.canonical_input_hash_version,
        output_kind,
        aggregate,
      };
    }

    return {
      ok: false,
      code: SANDBOX_RESOLVE_ERROR_CODES.EXECUTION_FAILED,
      message: 'unknown composition_mode',
      status: 500,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = (e as Error & { code?: string })?.code;
    if (code === 'ML_INFERENCE_UNAVAILABLE') {
      return { ok: false, code, message: msg, status: 503 };
    }
    return {
      ok: false,
      code: SANDBOX_RESOLVE_ERROR_CODES.EXECUTION_FAILED,
      message: msg,
      status: 500,
    };
  }
}
