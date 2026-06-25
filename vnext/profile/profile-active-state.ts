/**
 * Profile active state: A + C(t) via existing overlay compose (comparison_pair canonical surface).
 * No home_daily. Transit context uses repo-root lib/canonical-location (same fingerprint as Campaign solo).
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import path from 'path';
import { createHash } from 'crypto';
import type { ComposeRequest } from '../explainer/contracts';
import { composeAPI } from '../api/compose';
import { getChartById } from '../compat/chart-store';
import type { Chart } from '../compat/types';
import { buildTransitChartInput } from '../campaign/transit-chart-input';
import { fetchChartSnapshot, type ChartInput } from '../core/architecture-engine';
import { getCanonicalLocationModule } from './load-canonical-location';
import { buildProfileNatalProjectionFromChartInput, PROFILE_CONTRACT_VERSION } from './profile-natal-projection';
import { snapshotFingerprint } from '../canonical/stable-json';
import { hashSnapshot } from '../rpg/hash/snapshot-hash';
import {
  extractTransitCurationFromSections,
  type TransitDiversificationContext,
} from '../projection/rule-layer/transit-overlay-curation';

export type ProfileActiveStateResult = {
  identity: {
    profile_contract_version: number;
    projection: 'active';
    surface_kind: 'comparison_pair';
    natal_snapshot_fingerprint: string;
    profile_natal_compose_anchor: string;
    transit_context_fingerprint: string;
    transit_snapshot_fingerprint: string;
    /** Same primitive as campaign daily-pressure provenance `transit_snapshot_hash` (hashSnapshot). */
    transit_snapshot_hash: string;
    object_identity_hash: string;
    compose_seed: string;
  };
  explanation: unknown;
  text: unknown;
  hashes: { plan_sha256: string; explanation: string; control: string; audio: string };
  export_id?: string | null;
  audio_export_available: boolean;
  fromCache?: boolean;
};

function chartRowToNatalInput(chart: Chart): ChartInput {
  if (!chart.timezone || !String(chart.timezone).trim()) {
    const err = new Error('NATAL_TIMEZONE_REQUIRED') as Error & { code?: string };
    err.code = 'NATAL_TIMEZONE_REQUIRED';
    throw err;
  }
  const t = chart.time;
  const timeNorm = typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : String(t || '12:00').slice(0, 5);
  return {
    date: chart.date,
    time: timeNorm,
    lat: chart.lat,
    lon: chart.lon,
    timezone: chart.timezone,
  };
}

function loadPgStore(): {
  getProfileProjectionCache: (cacheKeyHash: string) => Promise<{
    response_json: unknown;
    object_identity_hash: string;
    diversification_context?: TransitDiversificationContext | null;
  } | null>;
  getPreviousTransitDiversificationContext: (
    chartId: string,
    beforeCalendarDate: string
  ) => Promise<TransitDiversificationContext | null>;
  upsertProfileProjectionCache: (row: {
    cache_key_hash: string;
    user_id: string | null;
    chart_id: string;
    projection_kind: string;
    object_identity_hash: string;
    response_json: unknown;
    diversification_context?: TransitDiversificationContext | null;
  }) => Promise<void>;
} | null {
  if (!process.env.POSTGRES_URL) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(path.join(process.cwd(), 'lib', 'pg-store.js'));
  } catch {
    return null;
  }
}

function activeCacheKeyHash(natalAnchor: string, transitFp: string): string {
  return createHash('sha256').update(`active_v2|${natalAnchor}|${transitFp}`, 'utf8').digest('hex');
}

/**
 * Build deterministic Profile active projection (overlay compose). Optional Postgres cache (no silent drift: miss → compute).
 * Text path: generateAudio false (default). Audio: generateAudio true with expected hashes from prior text response.
 */
export async function buildProfileActiveStateProjection(params: {
  chartId: string;
  calendarDate: string;
  localTime: string;
  location: Record<string, unknown>;
  userId?: string | null;
  skipCache?: boolean;
  /** When true, run Lyria/export; requires expectedPlanSha256 + expectedObjectIdentityHash from prior text-only response. */
  generateAudio?: boolean;
  expectedPlanSha256?: string;
  expectedObjectIdentityHash?: string;
}): Promise<ProfileActiveStateResult> {
  const cl = getCanonicalLocationModule();
  const v = cl.validateCanonicalLocation(params.location);
  if (!v.ok) {
    const e = new Error(v.error) as Error & { code?: string };
    e.code = v.code || 'LOCATION_INVALID';
    throw e;
  }
  const loc = v.location as {
    source: string;
    label: string;
    lat: number;
    lon: number;
    timezone: string;
    resolvedAt: string;
  };
  const timeNorm = params.localTime.length === 5 ? params.localTime : params.localTime.slice(0, 5);
  const transitContextFingerprint = cl.transitContextFingerprint(loc, params.calendarDate, timeNorm);

  const chart = await getChartById(params.chartId);
  if (!chart) throw new Error(`Chart not found: ${params.chartId}`);

  let natalInput: ChartInput;
  try {
    natalInput = chartRowToNatalInput(chart);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && (e as { code?: string }).code === 'NATAL_TIMEZONE_REQUIRED') throw e;
    throw e;
  }

  const natalBundle = await buildProfileNatalProjectionFromChartInput(natalInput);
  const natalAnchor = natalBundle.anchor;
  const natal_snapshot_fingerprint = natalBundle.natal_snapshot_fingerprint;

  const transitInput = buildTransitChartInput({
    date: params.calendarDate,
    time: timeNorm,
    location: { lat: loc.lat, lon: loc.lon, timezone: loc.timezone },
  });
  const transitSnapshot = await fetchChartSnapshot(transitInput);
  const transit_snapshot_fingerprint = snapshotFingerprint(transitSnapshot);
  const transit_snapshot_hash = hashSnapshot(transitSnapshot);

  const generateAudio = params.generateAudio === true;
  const cacheKey =
    activeCacheKeyHash(natalAnchor, transitContextFingerprint) + (generateAudio ? '|ga1' : '|ga0');
  const pg = !params.skipCache && !generateAudio ? loadPgStore() : null;
  if (pg) {
    const row = await pg.getProfileProjectionCache(cacheKey);
    if (row && row.response_json && typeof row.response_json === 'object') {
      const parsed = row.response_json as ProfileActiveStateResult;
      if (parsed.identity?.object_identity_hash === row.object_identity_hash) {
        return { ...parsed, fromCache: true };
      }
    }
  }

  const calendarDate = params.calendarDate.slice(0, 10);
  const previousDiversification: TransitDiversificationContext | null =
    pg && typeof pg.getPreviousTransitDiversificationContext === 'function'
      ? await pg.getPreviousTransitDiversificationContext(params.chartId, calendarDate)
      : null;

  const currentDatetime = `${params.calendarDate}T${timeNorm}:00`;
  const composeSeed = createHash('sha256').update(`${natalAnchor}|${transitContextFingerprint}|overlay`, 'utf8').digest('hex');

  const chartTimeNorm =
    typeof chart.time === 'string' && chart.time.length >= 5
      ? chart.time.slice(0, 5)
      : String(chart.time || '12:00').slice(0, 5);
  const overlayParams: NonNullable<ComposeRequest['overlayParams']> = {
    natalLatitude: chart.lat,
    natalLongitude: chart.lon,
    /** Align with Identity tab: birth date/time from chart row, not snapshot.ts (avoids TZ/parsing drift). */
    natalDatetime: `${chart.date}T${chartTimeNorm}:00`,
    natalTimezone: chart.timezone,
    currentLatitude: loc.lat,
    currentLongitude: loc.lon,
    currentDatetime,
    currentTimezone: loc.timezone,
  };

  const composeReq: ComposeRequest = {
    mode: 'overlay',
    overlayParams,
    seed: composeSeed,
    transitCalendarDate: calendarDate,
    transitDiversificationContext: previousDiversification,
    generateAudio,
    ...(params.userId && String(params.userId).trim()
      ? { sessionUserId: String(params.userId).trim() }
      : {}),
    ...(generateAudio &&
    typeof params.expectedPlanSha256 === 'string' &&
    params.expectedPlanSha256.length > 0 &&
    typeof params.expectedObjectIdentityHash === 'string' &&
    params.expectedObjectIdentityHash.length > 0
      ? {
          expectedPlanSha256: params.expectedPlanSha256,
          expectedObjectIdentityHash: params.expectedObjectIdentityHash,
        }
      : {}),
  };

  const composeResult = (await composeAPI.compose(composeReq)) as unknown as {
    explanation: { meta: { canonical_object_hash: string } };
    text: unknown;
    hashes: { plan_sha256: string; explanation: string; control: string; audio: string };
    export_id?: string | null;
    audio_export_available?: boolean;
  };

  const object_identity_hash = composeResult.explanation?.meta?.canonical_object_hash;
  if (!object_identity_hash || object_identity_hash.length !== 64) {
    throw new Error('Profile active state: compose response missing canonical_object_hash');
  }

  const out: ProfileActiveStateResult = {
    identity: {
      profile_contract_version: PROFILE_CONTRACT_VERSION,
      projection: 'active',
      surface_kind: 'comparison_pair',
      natal_snapshot_fingerprint,
      profile_natal_compose_anchor: natalAnchor,
      transit_context_fingerprint: transitContextFingerprint,
      transit_snapshot_fingerprint,
      transit_snapshot_hash,
      object_identity_hash,
      compose_seed: composeSeed,
    },
    explanation: composeResult.explanation,
    text: composeResult.text,
    hashes: {
      plan_sha256: composeResult.hashes.plan_sha256,
      explanation: composeResult.hashes.explanation,
      control: composeResult.hashes.control,
      audio: composeResult.hashes.audio,
    },
    export_id: composeResult.export_id ?? null,
    audio_export_available: composeResult.audio_export_available === true,
    fromCache: false,
  };

  if (pg && !generateAudio) {
    const explanation = composeResult.explanation as { sections?: Array<{ meta?: unknown }> } | undefined;
    const diversification_context =
      extractTransitCurationFromSections(explanation?.sections ?? []) ??
      (previousDiversification
        ? {
            ...previousDiversification,
            calendarDate,
            generatedAt: new Date().toISOString(),
          }
        : null);

    await pg.upsertProfileProjectionCache({
      cache_key_hash: cacheKey,
      user_id: params.userId ?? null,
      chart_id: params.chartId,
      projection_kind: 'active',
      object_identity_hash,
      response_json: out,
      diversification_context,
    });
  }

  return out;
}
