/**
 * Profile chart: snapshot + explainer from vnext engine (no audio).
 * Reuses encodeFeatures, payload-from-seed, composeAPI.getExplainerSectionsForFeatures.
 */

import type { EphemerisSnapshot } from '../contracts';
import { encodeFeatures } from '../feature-encode';
import { composeAPI } from '../api/compose';
import { controlPayloadFromSeed } from './payload-from-seed';
import * as storage from './storage';
import type { Chart } from './types';

const PORT = process.env.PORT || '3000';
const BASE_URL = process.env.COMPAT_CHART_BASE_URL || `http://localhost:${PORT}`;

async function fetchChartSnapshot(
  date: string,
  time: string,
  lat: number,
  lon: number
): Promise<EphemerisSnapshot> {
  const t = time.length === 5 ? time : time.slice(0, 5);
  const q = new URLSearchParams({ date, time: t, lat: String(lat), lon: String(lon) });
  const r = await fetch(`${BASE_URL}/api/chart-snapshot?${q}`);
  if (!r.ok) throw new Error(`chart-snapshot failed: ${r.status}`);
  return r.json() as Promise<EphemerisSnapshot>;
}

export interface ProfileChartResult {
  chart: Chart;
  snapshot: EphemerisSnapshot;
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

  const snapshot = await fetchChartSnapshot(chart.date, chart.time, chart.lat, chart.lon);
  const featureVec = encodeFeatures(snapshot);
  const seed = `profile_${chart.id}`;
  const payload = controlPayloadFromSeed(seed);

  const explainer = await composeAPI.getExplainerSectionsForFeatures(
    featureVec as import('../contracts').FeatureVec,
    payload,
    snapshot
  );

  return {
    chart,
    snapshot,
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
