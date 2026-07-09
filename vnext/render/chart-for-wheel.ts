import type { EphemerisSnapshot } from '../contracts';
import { normalizeDeg } from './wheel-geometry';

/**
 * Chart shape required by the wheel renderer.
 * Backend /chart returns { positions, cusps }; compose may return controls without chart data.
 */
export type ChartForWheel = {
  positions: Record<string, number>;
  cusps: number[];
  asc?: number;
};

/** Resolve H1 / ASC longitude for anchoring (cusps[0] or chart.asc). */
export function resolveAscendantLongitude(chart: ChartForWheel, ascendantOverride?: number): number {
  if (typeof ascendantOverride === 'number' && Number.isFinite(ascendantOverride)) {
    return normalizeDeg(ascendantOverride);
  }
  if (typeof chart.asc === 'number' && Number.isFinite(chart.asc)) {
    return normalizeDeg(chart.asc);
  }
  if (chart.cusps.length >= 1 && Number.isFinite(chart.cusps[0])) {
    return normalizeDeg(chart.cusps[0]!);
  }
  return 0;
}

function normalizePlanetKey(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/** Derive South Node longitude from North Node (+180°, normalized 0–360). */
export function deriveSouthNodeLongitude(northNodeLon: number): number {
  return normalizeDeg(northNodeLon + 180);
}

function injectDerivedSouthNode(positions: Record<string, number>): void {
  const north =
    positions.northNode ??
    positions.northnode ??
    positions.NorthNode;
  if (typeof north !== 'number' || !Number.isFinite(north)) return;
  if (positions.southNode != null || positions.southnode != null) return;
  positions.southNode = deriveSouthNodeLongitude(north);
}

/**
 * Normalize backend/compose payload into ChartForWheel.
 * Accepts: { positions, cusps }, or { planets: [{ name, lon }], houses }, or compatible shapes.
 */
export function normalizeChartForWheel(raw: unknown): ChartForWheel | null {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  let positions: Record<string, number> = {};
  let cusps: number[] = [];

  if (obj.positions != null && typeof obj.positions === 'object' && !Array.isArray(obj.positions)) {
    const p = obj.positions as Record<string, unknown>;
    for (const [k, v] of Object.entries(p)) {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      if (Number.isFinite(n)) positions[normalizePlanetKey(k)] = n;
    }
  }

  if (obj.cusps != null && Array.isArray(obj.cusps)) {
    cusps = obj.cusps
      .slice(0, 12)
      .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
      .filter(Number.isFinite);
  }

  if ((!positions || Object.keys(positions).length === 0) && Array.isArray(obj.planets)) {
    for (const entry of obj.planets) {
      if (entry && typeof entry === 'object') {
        const rawName = (entry as { name?: string }).name ?? (entry as { id?: string }).id;
        const lon = (entry as { lon?: number }).lon ?? (entry as { longitude?: number }).longitude;
        if (rawName && Number.isFinite(lon)) {
          positions[normalizePlanetKey(String(rawName))] = Number(lon);
        }
      }
    }
  }
  if (cusps.length < 12 && Array.isArray(obj.houses)) {
    cusps = obj.houses
      .slice(0, 12)
      .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
      .filter(Number.isFinite);
  }

  if (cusps.length < 12) {
    const asc = typeof obj.asc === 'number' ? obj.asc : cusps[0] ?? 0;
    cusps = Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
  }

  injectDerivedSouthNode(positions);

  if (Object.keys(positions).length === 0 || cusps.length !== 12) {
    return null;
  }

  const asc = typeof obj.asc === 'number' ? obj.asc : cusps[0];
  return { positions, cusps, asc };
}

/** Convert an EphemerisSnapshot into ChartForWheel input for the renderer. */
export function normalizeSnapshotForWheel(snapshot: EphemerisSnapshot): ChartForWheel | null {
  const positions: Record<string, number> = {};
  for (const planet of snapshot.planets) {
    if (!planet?.name || !Number.isFinite(planet.lon)) continue;
    positions[normalizePlanetKey(planet.name)] = planet.lon;
  }

  injectDerivedSouthNode(positions);

  const houses = snapshot.houses ?? [];
  const cusps = houses
    .slice(0, 12)
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter(Number.isFinite);

  return normalizeChartForWheel({
    positions,
    cusps,
    asc: cusps[0],
  });
}
