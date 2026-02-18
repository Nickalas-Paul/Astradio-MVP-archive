/**
 * Personality API - Phase 1 Foundation
 * 
 * Returns personality profile, astro profile, and narrative sections.
 * Does NOT generate music or call compose.
 */

import { generateArchitecture, type ChartInput } from '../core/architecture-engine';
import { buildExplainSpecSingle } from '../explainer/text-generation-engine';
import { renderExplainSpecToSections } from '../explainer/renderers/deterministic';
import { guidanceSummaryFromFeatureVec } from '../explainer/guidance-atoms';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { GateReport } from '../explainer/contracts';

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
export async function generatePersonalityReport(
  request: PersonalityRequest
): Promise<PersonalityResponse> {
  // Resolve chart input
  let chartInput: ChartInput;
  if (request.chart) {
    chartInput = request.chart;
  } else if (request.chartId) {
    // TODO: Load chart from storage by ID
    throw new Error('chartId lookup not yet implemented; use inline chart');
  } else {
    throw new Error('Either chart or chartId must be provided');
  }

  // Generate architecture (snapshot, features, personality, astroProfile, guidance)
  const architecture = await generateArchitecture(chartInput, request.seed);

  // Build ExplainSpec in personality mode (no plan, no gates, no music)
  // Create minimal stubs for explainer compatibility
  const guidanceSummary = guidanceSummaryFromFeatureVec(architecture.features);
  
  // Minimal plan stub for explainer (personality API doesn't generate music)
  const planStub = {
    id: `personality_${architecture.seed.slice(0, 8)}`,
    featureHash: '',
    durationSec: 60,
    bpm: 0,
    key: '',
    events: []
  };
  
  // Minimal planSummary stub
  const planSummaryStub = {
    totalEvents: 0,
    melodyEvents: 0,
    harmonyEvents: 0,
    bassEvents: 0,
    rhythmEvents: 0,
    avgInterval: 0,
    density: 'low' as const
  };
  
  // Minimal gateReport stub (always pass for personality mode)
  // Matches GateReport type exactly: no overall in scores, latency_ms is object
  const gateReportStub: GateReport = {
    calibrated: {
      melody_arc: true,
      melody_step_leap: true,
      melody_narrative: true,
      rhythm_diversity: true,
      overall: true
    },
    strict: {
      melody_arc: true,
      melody_step_leap: true,
      melody_narrative: true,
      rhythm_diversity: true,
      overall: true
    },
    scores: {
      melody_arc: 1.0,
      melody_step_leap: 1.0,
      melody_narrative: 1.0,
      rhythm_diversity: 1.0
      // Note: scores does NOT include 'overall' per GateReport type
    },
    latency_ms: {
      predict: 0,
      plan: 0,
      total: 0
    }
  };

  const spec = buildExplainSpecSingle({
    seed: architecture.seed,
    snapshot: architecture.snapshot,
    featureVec: architecture.features,
    guidanceSummary,
    plan: planStub as any,
    planSummary: planSummaryStub as any,
    gateReport: gateReportStub
  });

  // Render to sections
  const rendered = renderExplainSpecToSections(spec);

  return {
    chart: chartInput,
    personality: architecture.personality,
    astroProfile: architecture.astroProfile,
    guidance: architecture.guidance,
    explanation: {
      spec: 'UnifiedSpecV1.1',
      sections: rendered.sections.map((s) => ({
        id: s.id,
        title: s.title,
        text: s.text,
        bullets: s.bullets
      }))
    },
    seed: architecture.seed,
    generatedAt: new Date().toISOString()
  };
}
