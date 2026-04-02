/**
 * Personality API — Profile natal projection only (unified anchor with GET /api/profile/chart).
 * No independent seed path; optional client `seed` is rejected fail-closed.
 */

import { getChartById } from '../compat/chart-store';
import type { ChartInput } from '../core/architecture-engine';
import {
  buildProfileNatalProjectionFromChartInput,
  PROFILE_CONTRACT_VERSION,
} from '../profile/profile-natal-projection';

export interface PersonalityRequest {
  chartId?: string;
  chart?: ChartInput;
  /** @deprecated Rejected — natal identity is derived from chart snapshot only. */
  seed?: string;
}

export interface PersonalityResponse {
  chart: ChartInput;
  personality: import('../astro/personality-profile').PersonalityProfileV1;
  astroProfile: import('../astro/profile-from-snapshot').AstroProfile;
  guidance: import('../astro/guidance').AstroGuidance & {
    elementBlend: import('../astro/guidance').ElementBlend;
    motionProfile: import('../astro/guidance').MotionProfile;
    narrativeArc: import('../astro/guidance').NarrativeArc;
    personality: import('../astro/personality-profile').PersonalityProfileV1;
  };
  explanation: {
    spec: string;
    sections: Array<{
      id: string;
      title: string;
      text: string;
      bullets?: string[];
      meta?: import('../projection/projection-types').ProjectedExplanationSection['meta'];
    }>;
    meta: { canonical_object_hash: string };
  };
  /** Same as profile_natal compose anchor (formerly ambiguous `seed`). */
  profile_natal_compose_anchor: string;
  object_identity_hash: string;
  profile_contract_version: number;
  surface_kind: 'profile_natal';
  generatedAt: string;
}

/**
 * Generate personality report from chart input — same projection pipeline as Profile chart explainer.
 */
export async function generatePersonalityReport(request: PersonalityRequest): Promise<PersonalityResponse> {
  if (request.seed !== undefined && request.seed !== null && String(request.seed).length > 0) {
    const err = new Error(
      'Personality API does not accept seed; natal identity is unified on chart snapshot (profile_natal anchor).'
    ) as Error & { code?: string };
    err.code = 'SEED_NOT_SUPPORTED';
    throw err;
  }

  let chartInput: ChartInput;
  if (request.chart) {
    chartInput = request.chart;
  } else if (request.chartId) {
    const chart = await getChartById(request.chartId);
    if (!chart) throw new Error(`Chart not found: ${request.chartId}`);
    chartInput = { date: chart.date, time: chart.time, lat: chart.lat, lon: chart.lon, timezone: chart.timezone };
  } else {
    throw new Error('Either chart or chartId must be provided');
  }

  const bundle = await buildProfileNatalProjectionFromChartInput(chartInput);

  return {
    chart: chartInput,
    personality: bundle.architecture.personality,
    astroProfile: bundle.architecture.astroProfile,
    guidance: bundle.architecture.guidance,
    explanation: {
      spec: bundle.explainer.spec,
      sections: bundle.explainer.sections as PersonalityResponse['explanation']['sections'],
      meta: bundle.explainer.meta,
    },
    profile_natal_compose_anchor: bundle.anchor,
    object_identity_hash: bundle.explainer.object_identity_hash,
    profile_contract_version: PROFILE_CONTRACT_VERSION,
    surface_kind: 'profile_natal',
    generatedAt: new Date().toISOString(),
  };
}
