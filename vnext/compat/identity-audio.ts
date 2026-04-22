/**
 * Profile natal identity audio: automatic compose + export id persistence (chart row).
 * Same canonical profile-natal surface as GET /api/profile/chart explainer text.
 */

import type { Chart } from './types';
import type { ChartInput } from '../core/architecture-engine';
import { buildProfileNatalProjectionFromChartInput } from '../profile/profile-natal-projection';
import { composeAPI } from '../api/compose';
import type { ComposeRequest } from '../explainer/contracts';
import * as storage from './storage';

function chartRowToInput(chart: Chart): ChartInput {
  const t =
    typeof chart.time === 'string' && chart.time.length >= 5
      ? chart.time.slice(0, 5)
      : String(chart.time || '12:00').slice(0, 5);
  return {
    date: chart.date,
    time: t,
    lat: chart.lat,
    lon: chart.lon,
    ...(chart.timezone?.trim() ? { timezone: chart.timezone.trim() } : {}),
  };
}

/** Natal snapshot fingerprint for change detection (same as profile explainer bundle). */
export async function natalSnapshotFingerprintForChart(chart: Chart): Promise<string | null> {
  if (!chart.timezone?.trim()) return null;
  try {
    const bundle = await buildProfileNatalProjectionFromChartInput(chartRowToInput(chart));
    return bundle.natal_snapshot_fingerprint;
  } catch (e) {
    console.warn('[compat] identity audio: fingerprint failed', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * After primary chart attach/update: generate identity WAV/export when natal identity changed or chart is new.
 * Does not throw — failures are logged; chart save must always succeed.
 */
export async function persistProfileIdentityAudioAfterPrimaryAttach(
  chart: Chart,
  priorNatalFingerprint: string | null
): Promise<void> {
  if (!chart.timezone?.trim()) return;

  const chartIn = chartRowToInput(chart);
  let bundle: Awaited<ReturnType<typeof buildProfileNatalProjectionFromChartInput>>;
  try {
    bundle = await buildProfileNatalProjectionFromChartInput(chartIn);
  } catch (e) {
    console.warn('[compat] identity audio: projection bundle failed', e instanceof Error ? e.message : e);
    return;
  }

  const newFp = bundle.natal_snapshot_fingerprint;
  const shouldGenerate = priorNatalFingerprint === null || priorNatalFingerprint !== newFp;
  if (!shouldGenerate) return;

  const tz = chart.timezone!.trim();
  const composeReq: ComposeRequest = {
    mode: 'sandbox',
    chartData: {
      date: chart.date,
      time: chartIn.time,
      lat: chart.lat,
      lon: chart.lon,
      timezone: tz,
    },
    seed: bundle.anchor,
    generateAudio: true,
  };

  try {
    const result = await composeAPI.compose(composeReq);
    const exportId = (result as { export_id?: string | null }).export_id;
    if (typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId)) {
      await storage.setChartIdentityExportId(chart.id, exportId);
    }
  } catch (e) {
    console.warn('[compat] identity audio: compose/export failed', e instanceof Error ? e.message : e);
  }
}
