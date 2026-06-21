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

export function isValidChartIdentityExportId(eid: unknown): eid is string {
  return typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid);
}

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
 * After first primary chart creation (registration): generate identity WAV/export when natal identity is new.
 * Does not throw — failures are logged; chart save must always succeed.
 */
export async function persistProfileIdentityAudioAfterPrimaryAttach(
  chart: Chart,
  priorNatalFingerprint: string | null
): Promise<void> {
  await runProfileIdentityAudioCompose(chart, priorNatalFingerprint, { logErrors: true });
}

/**
 * User-initiated identity audio (Identity tab CTA). Awaits compose and returns export id or error.
 */
export async function generateProfileIdentityAudioForChart(
  chart: Chart
): Promise<{ identity_export_id: string | null; error?: string }> {
  if (!chart.timezone?.trim()) {
    return { identity_export_id: null, error: 'Chart timezone required for audio composition' };
  }
  if (isValidChartIdentityExportId(chart.identityExportId)) {
    return { identity_export_id: chart.identityExportId };
  }
  const priorNatalFingerprint = await natalSnapshotFingerprintForChart(chart);
  const exportId = await runProfileIdentityAudioCompose(chart, priorNatalFingerprint, { logErrors: false });
  if (exportId) {
    return { identity_export_id: exportId };
  }
  const freshChart = await storage.getChart(chart.id);
  if (freshChart && isValidChartIdentityExportId(freshChart.identityExportId)) {
    return { identity_export_id: freshChart.identityExportId };
  }
  return {
    identity_export_id: null,
    error: 'Audio composition failed or export is disabled on the server',
  };
}

async function runProfileIdentityAudioCompose(
  chart: Chart,
  priorNatalFingerprint: string | null,
  opts: { logErrors: boolean }
): Promise<string | null> {
  if (!chart.timezone?.trim()) return null;

  const chartIn = chartRowToInput(chart);
  let bundle: Awaited<ReturnType<typeof buildProfileNatalProjectionFromChartInput>>;
  try {
    bundle = await buildProfileNatalProjectionFromChartInput(chartIn);
  } catch (e) {
    if (opts.logErrors) {
      console.warn('[compat] identity audio: projection bundle failed', e instanceof Error ? e.message : e);
    }
    return null;
  }

  const newFp = bundle.natal_snapshot_fingerprint;
  const hasExistingExport = isValidChartIdentityExportId(chart.identityExportId);
  const shouldGenerate =
    !hasExistingExport || priorNatalFingerprint === null || priorNatalFingerprint !== newFp;
  if (!shouldGenerate) {
    if (isValidChartIdentityExportId(chart.identityExportId)) {
      return chart.identityExportId;
    }
    const freshAfterSkip = await storage.getChart(chart.id);
    if (freshAfterSkip && isValidChartIdentityExportId(freshAfterSkip.identityExportId)) {
      return freshAfterSkip.identityExportId;
    }
    return null;
  }

  const freshChart = await storage.getChart(chart.id);
  if (freshChart && isValidChartIdentityExportId(freshChart.identityExportId)) {
    return freshChart.identityExportId;
  }

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
    lyriaProfileNatalIdentityAudio: true,
  };

  try {
    const result = await composeAPI.compose(composeReq);
    const exportId = (result as { export_id?: string | null }).export_id;
    if (typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId)) {
      await storage.setChartIdentityExportId(chart.id, exportId);
      try {
        const ownerUserId = chart.ownerId?.trim();
        if (ownerUserId) {
          await storage.ensureProfileIdentityLibraryEntry({
            ownerUserId,
            chartId: chart.id,
            exportId,
            natalFingerprint: newFp,
          });
        }
      } catch (libErr) {
        if (opts.logErrors) {
          console.warn(
            '[compat] identity audio: library insert failed',
            libErr instanceof Error ? libErr.message : libErr
          );
        }
      }
      return exportId;
    }
    return null;
  } catch (e) {
    if (opts.logErrors) {
      console.warn('[compat] identity audio: compose/export failed', e instanceof Error ? e.message : e);
    }
    return null;
  }
}
