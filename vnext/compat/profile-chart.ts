/**
 * Profile chart: snapshot + explainer from vnext engine (no audio).
 * Uses architecture-engine (generateArchitecture) + composeAPI.getExplainerSectionsForFeatures.
 */

import { generateArchitecture, type ChartInput } from '../core/architecture-engine';
import { composeAPI } from '../api/compose';
import { controlPayloadFromSeed } from './payload-from-seed';
import * as storage from './storage';
import type { Chart } from './types';

function chartToChartInput(chart: Chart): ChartInput {
  return { date: chart.date, time: chart.time, lat: chart.lat, lon: chart.lon, timezone: chart.timezone };
}

export interface ProfileChartResult {
  chart: Chart;
  snapshot: import('../contracts').EphemerisSnapshot;
  explainer: { spec: string; sections: Array<{ id: string; title: string; text: string; bullets?: string[] }> };
  meta: { encoderVersion: string; explainerVersion: string; generatedAt: string };
}

/**
 * Load chart, resolve snapshot, run explainer pipeline (no audio). Deterministic for same chartId.
 */
export async function getProfileChartExplainer(chartId: string): Promise<ProfileChartResult> {
  const chart = chartId === storage.DEFAULT_PROFILE_CHART_ID
    ? storage.getChart(storage.DEFAULT_PROFILE_CHART_ID)!
    : storage.getChart(chartId);
  if (!chart) throw new Error(`Chart not found: ${chartId}`);

  const architecture = await generateArchitecture(chartToChartInput(chart), `profile_${chart.id}`);
  const payload = controlPayloadFromSeed(`profile_${chart.id}`);

  const explainer = await composeAPI.getExplainerSectionsForFeatures(
    architecture.features,
    payload,
    architecture.snapshot
  );

  return {
    chart,
    snapshot: architecture.snapshot,
    explainer: {
      spec: explainer.spec,
      sections: explainer.sections
    },
    meta: {
      encoderVersion: 'v1',
      explainerVersion: explainer.spec,
      generatedAt: new Date().toISOString()
    }
  };
}
