import type { ChartForWheel } from '../../core/chart-adapter';

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Ecliptic longitude relative to the Ascendant for wheel placement (0° = 9 o'clock).
 * Equivalent to visualAngle = (ascendantLongitude - longitude) + 180° before polar conversion.
 */
export function wheelEclipticDeg(lonDeg: number, ascendantDeg: number): number {
  return normalizeDeg(lonDeg - ascendantDeg);
}

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

/** Polar offset from wheel center (post-translate group). ASC at 9 o'clock when ascendantDeg matches H1. */
export function pol(r: number, eclLonDeg: number, ascendantDeg: number = 0): { x: number; y: number } {
  const wheelDeg = wheelEclipticDeg(eclLonDeg, ascendantDeg);
  const a = ((-wheelDeg + 180) * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

/** House sector path between two ecliptic cusp longitudes, anchored to ASC at 9 o'clock. */
export function arcPath(
  r1: number,
  r2: number,
  cuspLon0: number,
  cuspLon1: number,
  ascendantDeg: number = 0
): string {
  const w0 = wheelEclipticDeg(cuspLon0, ascendantDeg);
  const w1 = wheelEclipticDeg(cuspLon1, ascendantDeg);
  const span = ((w1 - w0 + 360) % 360) || 360;
  const wEnd = (w0 + span) % 360;
  const rad0 = ((-w0 + 180) * Math.PI) / 180;
  const rad1 = ((-wEnd + 180) * Math.PI) / 180;
  const p0 = { x: r1 * Math.cos(rad0), y: r1 * Math.sin(rad0) };
  const p1 = { x: r1 * Math.cos(rad1), y: r1 * Math.sin(rad1) };
  const p2 = { x: r2 * Math.cos(rad1), y: r2 * Math.sin(rad1) };
  const p3 = { x: r2 * Math.cos(rad0), y: r2 * Math.sin(rad0) };
  const large = span > 180 ? 1 : 0;
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r1} ${r1} 0 ${large} 0 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${r2} ${r2} 0 ${large} 1 ${p3.x} ${p3.y}`,
    'Z',
  ].join(' ');
}

/** Canonical degree rounding: 0.1° precision for determinism */
export function roundDegree(lonDeg: number): number {
  return Math.round(lonDeg * 10) / 10;
}

/** Pointer angle (SVG coords) → absolute ecliptic longitude, accounting for ASC anchor. */
export function angleToLonDeg(angleRad: number, ascendantDeg: number = 0): number {
  let wheelLon = (-angleRad * 180) / Math.PI + 180;
  while (wheelLon < 0) wheelLon += 360;
  while (wheelLon >= 360) wheelLon -= 360;
  let lonDeg = wheelLon + ascendantDeg;
  while (lonDeg < 0) lonDeg += 360;
  while (lonDeg >= 360) lonDeg -= 360;
  return roundDegree(lonDeg);
}
