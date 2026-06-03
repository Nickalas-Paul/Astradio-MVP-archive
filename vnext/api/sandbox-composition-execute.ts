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
  type CompositionSlotInput,
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
import { ADDITIONAL_BODIES } from '../canonical-bodies';
import type { ExpansionTier } from '../projection/projection-types';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import {
  assembleSandboxSynastryReport,
  stripSandboxSynastryLegacySections,
  type SandboxSynastryParticipantV1,
  type SandboxSynastryReportV1,
} from '../projection/rule-layer/sandbox-synastry-assembly';
import { resolveParticipantLabels } from '../relational/composition/resolve-participant-labels';

const SANDBOX_GROUP_SEED_VERSION = 'sandbox_group_v3';
/** Sandbox pair/group aggregate projection tier (baseline compat_pair yields near-empty sections). */
const SANDBOX_AGGREGATE_EXPANSION_TIER: ExpansionTier = 'extended';
/** Friendship lens for all Sandbox pair/group synastry (not user-configurable). */
const SANDBOX_PAIR_GROUP_RELATIONSHIP_MODE: RelationshipMode = 'friends';
export const SANDBOX_RESOLVE_PIPELINE_VERSION = 'sandbox_synastry_v1' as const;

/** Optional server-injected context for Phase 6E label resolution (YOUR requires ownership proof). */
export type ExecuteSandboxCompositionContext = {
  labelResolutionOwnerId?: string;
};

export const SANDBOX_RESOLVE_ERROR_CODES = {
  ...SANDBOX_COMPOSITION_ERROR_CODES,
  CHART_NOT_FOUND: 'chart_not_found',
  MISSING_STORED_VECTORS: 'missing_stored_vectors',
  EXECUTION_FAILED: 'execution_failed',
} as const;

export type SandboxSynastryNotice = 'asteroids_excluded_v1';

export type SandboxResolveSuccess = {
  ok: true;
  composition_mode: NormalizedCompositionSuccess['composition_mode'];
  canonical_slot_order: string[];
  canonical_input_hash: string;
  canonical_input_hash_version: number;
  output_kind: NormalizedCompositionSuccess['output_kind'];
  compose?: ComposeResponse;
  aggregate?: AggregateComposeResult;
  /** UX hint when user longitude-overrode an asteroid body (synastry/library still core-body scoped). */
  synastryNotice?: SandboxSynastryNotice;
  /** Pair/group synastry activations with Sonic Interplay (parallel to explanation sections). */
  sandboxSynastryReport?: SandboxSynastryReportV1;
  /** Deploy verification: present on pair/group resolves when synastry pipeline is active. */
  resolve_pipeline_version?: typeof SANDBOX_RESOLVE_PIPELINE_VERSION;
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

async function buildSandboxSynastryParticipants(
  populated: SandboxSlotResolution[],
  input: SandboxCompositionInputV1,
  viewerChartId?: string,
  labelResolutionOwnerId?: string
): Promise<SandboxSynastryParticipantV1[]> {
  const chartIdsOrdered = populated.map((r) => r.chart_id ?? null);
  const hasChartIds = chartIdsOrdered.some((id) => id != null);

  if (hasChartIds) {
    const resolved = await resolveParticipantLabels(chartIdsOrdered, {
      ...(viewerChartId ? { viewerChartId } : {}),
      ...(labelResolutionOwnerId ? { labelResolutionOwnerId } : {}),
    });
    if (resolved.length === populated.length) {
      return resolved.map((r) => ({ slotIndex: r.slotIndex, label: r.label }));
    }
  }

  let personSeq = 0;
  const nextPersonLabel = (): string => {
    personSeq += 1;
    return `Person ${personSeq}`;
  };

  const out: SandboxSynastryParticipantV1[] = [];
  for (let i = 0; i < populated.length; i++) {
    const r = populated[i]!;
    const wireSlot = input.slots[r.ui_index] as CompositionSlotInput & { chart_display_name?: string };
    const wireName =
      typeof wireSlot?.chart_display_name === 'string' && wireSlot.chart_display_name.trim()
        ? wireSlot.chart_display_name.trim()
        : '';
    if (wireName) {
      out.push({ slotIndex: i, label: wireName });
      continue;
    }
    if (r.chart_id) {
      const chart = await getChartById(r.chart_id);
      const chartLabel = typeof chart?.label === 'string' && chart.label.trim() ? chart.label.trim() : '';
      if (chartLabel) {
        out.push({ slotIndex: i, label: chartLabel });
        continue;
      }
    }
    out.push({ slotIndex: i, label: nextPersonLabel() });
  }
  return out;
}

function sandboxAggregateOpts(output_kind: 'full' | 'feed_card', generateAudio: boolean) {
  return {
    output_kind,
    generateAudio,
    expansionTier: SANDBOX_AGGREGATE_EXPANSION_TIER,
  } as const;
}

function applySandboxSynastryReportToAggregate(
  aggregate: AggregateComposeResult,
  report: SandboxSynastryReportV1 | null
): AggregateComposeResult {
  if (!report || report.pairSections.length === 0) {
    return aggregate;
  }
  const sections = aggregate.explanation?.sections;
  if (!Array.isArray(sections)) return aggregate;
  return {
    ...aggregate,
    explanation: {
      ...aggregate.explanation,
      sections: stripSandboxSynastryLegacySections(sections),
    },
  };
}

function isChartNotFoundErr(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e as Error & { code?: string }).code === SANDBOX_RESOLVE_ERROR_CODES.CHART_NOT_FOUND
  );
}

const ASTEROID_BODY_KEYS = new Set<string>(ADDITIONAL_BODIES as unknown as string[]);

/** True when any slot applies a planet longitude override targeting an additional-body key (asteroids). */
export function synastryNoticeForAsteroidLongitudeOverrides(
  resolutions: SandboxSlotResolution[]
): SandboxSynastryNotice | undefined {
  for (const r of resolutions) {
    const planets = r.overrides?.planets || {};
    for (const key of Object.keys(planets)) {
      if (ASTEROID_BODY_KEYS.has(key.toLowerCase())) {
        return 'asteroids_excluded_v1';
      }
    }
  }
  return undefined;
}

/**
 * Resolve sandbox composition through canonical pipeline only.
 */
export async function executeSandboxComposition(
  body: unknown,
  ctx?: ExecuteSandboxCompositionContext
): Promise<SandboxResolveResult> {
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
  const synastryNotice = synastryNoticeForAsteroidLongitudeOverrides(normalized.slot_resolutions);
  const wantAudio = input.generateAudio === true;
  const audioComposeOpts =
    wantAudio && input.expectedPlanSha256 && input.expectedObjectIdentityHash
      ? {
          generateAudio: true as const,
          expectedPlanSha256: input.expectedPlanSha256,
          expectedObjectIdentityHash: input.expectedObjectIdentityHash,
        }
      : { generateAudio: wantAudio };

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
          ...audioComposeOpts,
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
          ...audioComposeOpts,
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
        ...(synastryNotice ? { synastryNotice } : {}),
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
        ...audioComposeOpts,
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
        ...(synastryNotice ? { synastryNotice } : {}),
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
      const relationshipMode = SANDBOX_PAIR_GROUP_RELATIONSHIP_MODE;
      const merged = mergeFeatureVectors(vecLow, vecHigh, {
        relationshipMode,
        wA,
        wB,
      });
      const idA = slotIdentityForComparisonSeed(rA);
      const idB = slotIdentityForComparisonSeed(rB);
      const seed = comparisonSeed(idA, idB, relationshipMode, FUSION_METHOD_BLEND_V1, wA, wB);
      const payload = controlPayloadFromSeed(seed);

      let aggregate = await composeAPI.runAggregateComposition({
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
        ...sandboxAggregateOpts(output_kind, wantAudio),
      });

      const pairSnapshots = [snapLow, snapHigh];
      let sandboxSynastryReport: SandboxSynastryReportV1 = {
        schema_version: 'sandbox_synastry_v1',
        mode: 'pair',
        pairSections: [],
      };
      try {
        const pairSynastryAspects = computeSynastryAspects({
          snapshotsOrdered: pairSnapshots,
          mode: 'pair',
        });
        const pairParticipants = await buildSandboxSynastryParticipants(
          populated,
          input,
          normalized.viewer_chart_id,
          ctx?.labelResolutionOwnerId
        );
        sandboxSynastryReport = assembleSandboxSynastryReport({
          mode: 'pair',
          participants: pairParticipants,
          snapshotsOrdered: pairSnapshots,
          pairInteractionAspectsV2: pairSynastryAspects,
        });
      } catch (synErr) {
        console.error(
          '[SANDBOX_PAIR_SYNASTRY_ASSEMBLY_ERROR]',
          synErr instanceof Error ? synErr.message : String(synErr)
        );
      }
      aggregate = applySandboxSynastryReportToAggregate(aggregate, sandboxSynastryReport);

      const sectionCount = aggregate.explanation?.sections?.length ?? 0;
      console.log(
        '[SANDBOX_PAIR_RESOLVE_DONE]',
        JSON.stringify({
          pipeline: SANDBOX_RESOLVE_PIPELINE_VERSION,
          synastryPairSections: sandboxSynastryReport.pairSections.length,
          explanationSections: sectionCount,
        })
      );

      return {
        ok: true,
        composition_mode: 'pair_aggregate',
        canonical_slot_order: normalized.canonical_slot_order,
        canonical_input_hash: normalized.canonical_input_hash,
        canonical_input_hash_version: normalized.canonical_input_hash_version,
        output_kind,
        aggregate,
        resolve_pipeline_version: SANDBOX_RESOLVE_PIPELINE_VERSION,
        ...(sandboxSynastryReport.pairSections.length > 0 ? { sandboxSynastryReport } : {}),
        ...(synastryNotice ? { synastryNotice } : {}),
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

      const chartIdsOrdered = populated.map((r) => r.chart_id) as (string | null)[];
      let aggregate = await composeAPI.runAggregateComposition({
        kind: 'group',
        anchorSnapshot: overriddenSnaps[0],
        snapshotsOrdered: overriddenSnaps,
        memberFeatureVecs: memberVecs as FeatureVec[],
        composite,
        payload,
        chartIdsOrdered,
        suppressEnsembleFraming: true,
        ...(normalized.viewer_chart_id ? { viewerChartId: normalized.viewer_chart_id } : {}),
        ...(ctx?.labelResolutionOwnerId
          ? { labelResolutionOwnerId: ctx.labelResolutionOwnerId }
          : {}),
        ...sandboxAggregateOpts(output_kind, wantAudio),
      });

      let sandboxSynastryReport: SandboxSynastryReportV1 = {
        schema_version: 'sandbox_synastry_v1',
        mode: 'group',
        pairSections: [],
      };
      try {
        const groupParticipants = await buildSandboxSynastryParticipants(
          populated,
          input,
          normalized.viewer_chart_id,
          ctx?.labelResolutionOwnerId
        );
        const groupSynastryAspects = computeSynastryAspects({
          snapshotsOrdered: overriddenSnaps,
          mode: 'group_matrix',
        });
        sandboxSynastryReport = assembleSandboxSynastryReport({
          mode: 'group',
          participants: groupParticipants,
          snapshotsOrdered: overriddenSnaps,
          pairInteractionAspectsV2: groupSynastryAspects,
        });
      } catch (synErr) {
        console.error(
          '[SANDBOX_GROUP_SYNASTRY_ASSEMBLY_ERROR]',
          synErr instanceof Error ? synErr.message : String(synErr)
        );
      }
      aggregate = applySandboxSynastryReportToAggregate(aggregate, sandboxSynastryReport);

      const sectionCount = aggregate.explanation?.sections?.length ?? 0;
      console.log(
        '[SANDBOX_GROUP_RESOLVE_DONE]',
        JSON.stringify({
          pipeline: SANDBOX_RESOLVE_PIPELINE_VERSION,
          synastryPairSections: sandboxSynastryReport.pairSections.length,
          explanationSections: sectionCount,
        })
      );

      return {
        ok: true,
        composition_mode: 'group_aggregate',
        canonical_slot_order: normalized.canonical_slot_order,
        canonical_input_hash: normalized.canonical_input_hash,
        canonical_input_hash_version: normalized.canonical_input_hash_version,
        output_kind,
        aggregate,
        resolve_pipeline_version: SANDBOX_RESOLVE_PIPELINE_VERSION,
        ...(sandboxSynastryReport.pairSections.length > 0 ? { sandboxSynastryReport } : {}),
        ...(synastryNotice ? { synastryNotice } : {}),
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
