/**
 * Sandbox chart import helpers: own-chart birth wire vs connection snapshot path.
 */
import type { EphemerisSnapshot, SandboxOverrides, SandboxSnapshotMeta, PlanetKey } from '../types/sandbox';
import { normalizeSandboxOverrides } from './sandbox-composition-state';

export const CHART_IMPORT_UNAVAILABLE_MSG =
  "This chart isn't available for import. Connect with this person first, or enter their birth data manually.";

function serializeNumberForHash(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const { createHash } = await import('crypto');
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Mirrors vnext/api/sandbox-snapshot hashOverrides for chart_id resolve seeds. */
export async function hashSandboxOverridesForSeed(overrides: SandboxOverrides): Promise<string> {
  const planets = overrides.planets || {};
  const sortedKeys = Object.keys(planets).sort((a, b) => a.localeCompare(b));
  const planetObj: Record<string, { lonDeg: string }> = {};
  for (const k of sortedKeys) {
    const v = planets[k as PlanetKey];
    if (v && typeof v.lonDeg === 'number' && Number.isFinite(v.lonDeg)) {
      planetObj[k] = { lonDeg: serializeNumberForHash(v.lonDeg) };
    }
  }
  const angles = overrides.angles;
  const anglePart: Record<string, string> = {};
  if (angles?.ascDeg !== undefined && typeof angles.ascDeg === 'number' && Number.isFinite(angles.ascDeg)) {
    anglePart.ascDeg = serializeNumberForHash(angles.ascDeg);
  }
  if (angles?.mcDeg !== undefined && typeof angles.mcDeg === 'number' && Number.isFinite(angles.mcDeg)) {
    anglePart.mcDeg = serializeNumberForHash(angles.mcDeg);
  }
  const payload = { planets: planetObj, angles: anglePart };
  return sha256Hex(JSON.stringify(payload));
}

/** Mirrors vnext/api/sandbox-composition-execute combinedChartIdOverridesHash. */
export async function combinedChartIdOverridesSeed(
  chartId: string,
  overrides: SandboxOverrides
): Promise<string> {
  const oh = await hashSandboxOverridesForSeed(normalizeSandboxOverrides(overrides));
  return sha256Hex(`${chartId.trim()}|${oh}`);
}

/** True when GET /api/charts/:id returned engine-grade birth fields (own chart). */
export function chartApiRecordHasEngineBirthFields(chart: Record<string, unknown>): boolean {
  if (!chart || typeof chart !== 'object') return false;
  const date = typeof chart.date === 'string' ? chart.date.trim() : '';
  const timeRaw = typeof chart.time === 'string' ? chart.time.trim() : '';
  const time = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : timeRaw;
  const lat =
    typeof chart.lat === 'number' && Number.isFinite(chart.lat)
      ? chart.lat
      : typeof (chart as { location?: { lat?: unknown } }).location?.lat === 'number' &&
          Number.isFinite((chart as { location: { lat: number } }).location.lat)
        ? (chart as { location: { lat: number } }).location.lat
        : null;
  const lon =
    typeof chart.lon === 'number' && Number.isFinite(chart.lon)
      ? chart.lon
      : typeof (chart as { location?: { lon?: unknown } }).location?.lon === 'number' &&
          Number.isFinite((chart as { location: { lon: number } }).location.lon)
        ? (chart as { location: { lon: number } }).location.lon
        : null;
  return Boolean(date && date.length >= 8 && time && time.length >= 4 && lat != null && lon != null);
}

/** Preview meta for connection imports (no client birth wire / sandbox snapshot POST). */
export async function previewMetaForChartIdImport(
  chartId: string,
  overrides: SandboxOverrides
): Promise<SandboxSnapshotMeta> {
  return {
    preview_only: true,
    combinedHash: await combinedChartIdOverridesSeed(chartId, overrides),
  };
}

/** Apply planet longitude overrides to a server snapshot for wheel preview (aspects unchanged). */
export function applySandboxOverridesToSnapshotLite(
  baseSnapshot: EphemerisSnapshot,
  overrides: SandboxOverrides
): EphemerisSnapshot {
  const normalized = normalizeSandboxOverrides(overrides);
  const overrideEntries = Object.entries(normalized.planets);
  if (overrideEntries.length === 0) return baseSnapshot;

  const planets = baseSnapshot.planets.map((p) => {
    const ov = normalized.planets[p.name as PlanetKey];
    if (ov && typeof ov.lonDeg === 'number' && Number.isFinite(ov.lonDeg)) {
      return { ...p, lon: ov.lonDeg };
    }
    return p;
  });
  return { ...baseSnapshot, planets };
}

export function chartImportHttpErrorMessage(status: number, data: Record<string, unknown>): string {
  const msg =
    (typeof data.error === 'string' && data.error) ||
    (typeof data.message === 'string' && data.message) ||
    null;
  if (status === 403) return CHART_IMPORT_UNAVAILABLE_MSG;
  if (msg) return msg;
  return `Chart request failed (${status})`;
}
