/**
 * Personality API - Phase 1 Foundation
 *
 * Returns personality profile, astro profile, and narrative sections.
 * Does NOT generate music or call compose.
 * Text sections are TextProjection(SemanticCore) only.
 */

import { generateArchitecture, type ChartInput } from '../core/architecture-engine';
import { getChartById } from '../compat/chart-store';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';

export interface PersonalityRequest {
  chartId?: string;
  chart?: ChartInput;
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
    sections: Array<{ id: string; title: string; text: string; bullets?: string[] }>;
  };
  seed: string;
  generatedAt: string;
}

/**
 * Generate personality report from chart input.
 *
 * This is the canonical way to get personality data without music generation.
 */
export async function generatePersonalityReport(request: PersonalityRequest): Promise<PersonalityResponse> {
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

  const architecture = await generateArchitecture(chartInput, request.seed);
  const seed = architecture.seed;
  const canonicalReport = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: [seed],
    snapshot: architecture.snapshot,
    featureVec: architecture.features,
    control_surface_hash: seed,
    compose_seed: seed,
    guidance: architecture.guidance,
  });
  const semanticCore = interpretCanonicalReportObject(canonicalReport);
  const projected = projectTextFromSemanticCore(semanticCore, seed);

  return {
    chart: chartInput,
    personality: architecture.personality,
    astroProfile: architecture.astroProfile,
    guidance: architecture.guidance,
    explanation: {
      spec: 'UnifiedSpecV1.1',
      sections: projected.map((s) => ({
        id: s.id,
        title: s.title,
        text: s.text,
        bullets: s.bullets,
      })),
    },
    seed: architecture.seed,
    generatedAt: new Date().toISOString(),
  };
}
