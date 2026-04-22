/**
 * Profile chart: snapshot + explainer from vnext engine (no audio).
 * Single natal projection identity with /api/personality (profile_natal + unified anchor).
 */

import { getChartById } from './chart-store';
import * as storage from './storage';
import type { Chart } from './types';
import { buildProfileNatalProjectionFromChartInput, PROFILE_CONTRACT_VERSION } from '../profile/profile-natal-projection';
import type { ChartInput } from '../core/architecture-engine';

function chartToChartInput(chart: Chart): ChartInput {
  return { date: chart.date, time: chart.time, lat: chart.lat, lon: chart.lon, timezone: chart.timezone };
}

export interface ProfileChartResult {
  chart: Chart;
  /** Nullable persisted Lyria/export id for natal identity audio (same chart row). */
  identity_export_id: string | null;
  snapshot: import('../contracts').EphemerisSnapshot;
  explainer: {
    spec: string;
    sections: Array<{ id: string; title: string; text: string; bullets?: string[]; meta?: unknown }>;
    meta: { canonical_object_hash: string };
  };
  /** Phase 8H: enriched relational chart context for reporting/relational consumers (natal structure only). */
  relationalContext: import('../report-context').RelationalChartContext;
  meta: { encoderVersion: string; explainerVersion: string; generatedAt: string };
  identity: {
    profile_contract_version: number;
    natal_snapshot_fingerprint: string;
    profile_natal_compose_anchor: string;
    object_identity_hash: string;
    surface_kind: 'profile_natal';
  };
  /** Canonical hashes for determinism checks (natal explainer path). */
  hashes: { plan_sha256: string; object_identity_hash: string };
  personality: import('../astro/personality-profile').PersonalityProfileV1;
  astroProfile: import('../astro/profile-from-snapshot').AstroProfile;
  guidance: import('../astro/guidance').AstroGuidance & {
    elementBlend: import('../astro/guidance').ElementBlend;
    motionProfile: import('../astro/guidance').MotionProfile;
    narrativeArc: import('../astro/guidance').NarrativeArc;
    personality: import('../astro/personality-profile').PersonalityProfileV1;
  };
}

/**
 * Load chart, resolve snapshot, run explainer pipeline (no audio). Deterministic for same chart ephemeris inputs.
 */
export async function getProfileChartExplainer(chartId: string): Promise<ProfileChartResult> {
  const chart =
    chartId === storage.DEFAULT_PROFILE_CHART_ID
      ? await getChartById(storage.DEFAULT_PROFILE_CHART_ID)
      : await getChartById(chartId);
  if (!chart) throw new Error(`Chart not found: ${chartId}`);

  const bundle = await buildProfileNatalProjectionFromChartInput(chartToChartInput(chart));

  return {
    chart,
    identity_export_id: chart.identityExportId ?? null,
    snapshot: bundle.snapshot,
    explainer: {
      spec: bundle.explainer.spec,
      sections: bundle.explainer.sections,
      meta: bundle.explainer.meta,
    },
    relationalContext: bundle.architecture.relationalContext,
    personality: bundle.architecture.personality,
    astroProfile: bundle.architecture.astroProfile,
    guidance: bundle.architecture.guidance,
    meta: {
      encoderVersion: 'v1',
      explainerVersion: bundle.explainer.spec,
      generatedAt: new Date().toISOString(),
    },
    identity: {
      profile_contract_version: PROFILE_CONTRACT_VERSION,
      natal_snapshot_fingerprint: bundle.natal_snapshot_fingerprint,
      profile_natal_compose_anchor: bundle.anchor,
      object_identity_hash: bundle.explainer.object_identity_hash,
      surface_kind: 'profile_natal',
    },
    hashes: {
      plan_sha256: bundle.explainer.plan_sha256,
      object_identity_hash: bundle.explainer.object_identity_hash,
    },
  };
}
