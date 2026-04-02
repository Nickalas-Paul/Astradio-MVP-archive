/**
 * Sandbox composition resolve — normalization + routing to existing compose / aggregate only.
 */

import * as crypto from 'crypto';
import type { ComposeRequest, ComposeResponse } from '../explainer/contracts';
import type { EphemerisSnapshot } from '../contracts';
import { composeAPI, type AggregateComposeResult } from './compose';
import {
  normalizeCompositionInput,
  type SandboxCompositionInputV1,
  type NormalizedCompositionSuccess,
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
import { resolveRelationalConnectionFromChartIds } from '../relational/resolve-relational-connection-context';
import { MissingVectorsError } from '../relational/compatibility/multi-chart';
import type { FeatureVec } from '../contracts';

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
  /** Single / overlay compose response */
  compose?: ComposeResponse;
  /** Pair / group aggregate result */
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

function combinedBirthOverridesHash(birth: import('../contracts').SandboxBirth, overrides: import('../contracts').SandboxOverrides): string {
  const bh = hashBirth(birth);
  const oh = hashOverrides(overrides);
  return crypto.createHash('sha256').update(bh + oh, 'utf8').digest('hex');
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

  const n = normalized.slot_resolutions.filter((r) => r.chart_id || r.birth).length;
  const output_kind = normalized.output_kind;

  try {
    if (normalized.composition_mode === 'single') {
      const r = normalized.slot_resolutions.find((x) => x.chart_id || x.birth)!;
      let composeReq: ComposeRequest;

      if (r.chart_id) {
        const chart = await getChartById(r.chart_id);
        if (!chart) {
          return {
            ok: false,
            code: SANDBOX_RESOLVE_ERROR_CODES.CHART_NOT_FOUND,
            message: `Chart not found: ${r.chart_id}`,
            status: 404,
          };
        }
        composeReq = {
          mode: 'sandbox',
          chartData: {
            date: chart.date,
            time: chart.time.slice(0, 5),
            lat: chart.lat,
            lon: chart.lon,
          },
          controls: normalized.compose_controls as ComposeRequest['controls'],
          seed: normalized.seed,
          output_kind,
        };
      } else if (r.birth) {
        const overrides = r.overrides || { planets: {} };
        const snap = await fetchChartSnapshot({
          date: r.birth.date,
          time: r.birth.time.length === 5 ? r.birth.time : r.birth.time.slice(0, 5),
          lat: r.birth.lat,
          lon: r.birth.lon,
          timezone: r.birth.tz,
        });
        const overridden = generateSnapshotWithOverrides(snap, overrides);
        const ch = combinedBirthOverridesHash(r.birth, overrides);
        composeReq = {
          mode: 'sandbox',
          overriddenSnapshot: overridden,
          controls: normalized.compose_controls as ComposeRequest['controls'],
          seed: normalized.seed && normalized.seed.length > 0 ? normalized.seed : ch,
          output_kind,
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
      const natalChart = await getChartById(tc.natal_chart_id);
      if (!natalChart) {
        return {
          ok: false,
          code: SANDBOX_RESOLVE_ERROR_CODES.CHART_NOT_FOUND,
          message: `Natal chart not found: ${tc.natal_chart_id}`,
          status: 404,
        };
      }
      const natalSnap = await fetchChartSnapshot(chartToChartInput(natalChart));
      const composeReq: ComposeRequest = {
        mode: 'overlay',
        overlayParams: {
          natalLatitude: natalSnap.lat,
          natalLongitude: natalSnap.lon,
          natalDatetime: natalSnap.ts,
          currentLatitude: tc.current_latitude,
          currentLongitude: tc.current_longitude,
          currentDatetime: tc.current_datetime,
        },
        controls: normalized.compose_controls as ComposeRequest['controls'],
        seed: normalized.seed,
        output_kind,
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
      const ids = normalized.canonical_slot_order;
      const idLow = ids[0];
      const idHigh = ids[1];
      const chartLow = await getChartById(idLow);
      const chartHigh = await getChartById(idHigh);
      if (!chartLow || !chartHigh) {
        return {
          ok: false,
          code: SANDBOX_RESOLVE_ERROR_CODES.CHART_NOT_FOUND,
          message: 'One or both charts not found',
          status: 404,
        };
      }
      const [snapLow, snapHigh] = await Promise.all([
        fetchChartSnapshot(chartToChartInput(chartLow)),
        fetchChartSnapshot(chartToChartInput(chartHigh)),
      ]);

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
      const seed = comparisonSeed(idLow, idHigh, relationshipMode, FUSION_METHOD_BLEND_V1, wA, wB);
      const payload = controlPayloadFromSeed(seed);

      const aggregate = await composeAPI.runAggregateComposition({
        kind: 'comparison',
        chartIdLow: idLow,
        chartIdHigh: idHigh,
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
      const chartIds = normalized.canonical_slot_order;
      try {
        const ctx = await resolveRelationalConnectionFromChartIds(chartIds, input.binding?.group_id);
        const anchorSnapshot = ctx.natalSnapshotsOrdered[0];
        const aggregate = await composeAPI.runAggregateComposition({
          kind: 'group',
          anchorSnapshot,
          snapshotsOrdered: ctx.natalSnapshotsOrdered,
          composite: ctx.composite as FeatureVec,
          payload: ctx.payload,
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
      } catch (e) {
        if (e instanceof MissingVectorsError) {
          return {
            ok: false,
            code: SANDBOX_RESOLVE_ERROR_CODES.MISSING_STORED_VECTORS,
            message: `missing_stored_vectors: ${(e as MissingVectorsError).message}`,
            status: 422,
          };
        }
        throw e;
      }
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
