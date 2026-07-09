export interface ChartForWheel {
  cusps: number[];
  asc?: number;
}

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

/** Zodiac sign ring segment (30° ecliptic slice). signIndex 0 = Aries. */
export function zodiacSegmentPath(
  rOuter: number,
  rInner: number,
  signIndex: number,
  ascendantDeg: number = 0
): string {
  const a0 = signIndex * 30;
  const a1 = a0 + 30;
  return arcPath(rOuter, rInner, a0, a1, ascendantDeg);
}

/** Smallest angular distance between two ecliptic longitudes (degrees). */
export function angularSeparationDeg(lonA: number, lonB: number): number {
  const d = Math.abs(normalizeDeg(lonA) - normalizeDeg(lonB));
  return d > 180 ? 360 - d : d;
}

/** Readable SVG text rotation aligned to radial angle from wheel center. */
export function radialLabelRotationDeg(x: number, y: number): number {
  let angle = (Math.atan2(y, x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}

/** Orb-tight aspect line weight (technical mode). */
export function aspectLineStyle(orb: number | undefined): { strokeWidth: number; strokeOpacity: number } {
  if (orb == null || !Number.isFinite(orb)) {
    return { strokeWidth: 1, strokeOpacity: 0.7 };
  }
  const o = Math.max(0, orb);
  return {
    strokeWidth: Math.max(0.5, 2 - (o / 8) * 1.5),
    strokeOpacity: Math.max(0.3, 0.9 - (o / 8) * 0.6),
  };
}

const CLUSTER_THRESHOLD_DEG = 12;

function radialShiftForClusterIndex(clusterIndex: number, offset: number, clusterSize: number): number {
  if (clusterIndex === 0) return 0;
  if (clusterSize >= 3) {
    const pattern = [offset, -offset, offset * 1.8, -offset * 1.8];
    const idx = clusterIndex - 1;
    if (idx < pattern.length) return pattern[idx]!;
    return idx % 2 === 0 ? offset * 1.8 : -offset * 1.8;
  }
  return clusterIndex % 2 === 1 ? -offset : offset;
}

function clampRadius(radius: number, minRadius?: number, maxRadius?: number): number {
  let r = radius;
  if (minRadius != null) r = Math.max(minRadius, r);
  if (maxRadius != null) r = Math.min(maxRadius, r);
  return r;
}

/** Radial offsets for planets within 12° of each other (matches mobile NatalWheel). */
export function clusterPlanetRadii(
  planets: Array<{ key: string; lon: number }>,
  baseRadius: number,
  size: number,
  minRadius?: number,
  maxRadius?: number
): Map<string, number> {
  const sorted = [...planets].sort((a, b) => a.lon - b.lon);
  const radii = new Map<string, number>();
  const offset = size * 0.035;

  if (sorted.length === 0) return radii;

  type ClusterMember = { key: string; lon: number };
  const clusters: ClusterMember[][] = [];
  let current: ClusterMember[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const planet = sorted[i]!;
    const prev = current[current.length - 1]!;
    if (angularSeparationDeg(planet.lon, prev.lon) < CLUSTER_THRESHOLD_DEG) {
      current.push(planet);
    } else {
      clusters.push(current);
      current = [planet];
    }
  }
  clusters.push(current);

  if (clusters.length >= 2) {
    const firstCluster = clusters[0]!;
    const lastCluster = clusters[clusters.length - 1]!;
    const firstPlanet = firstCluster[0]!;
    const lastPlanet = lastCluster[lastCluster.length - 1]!;
    if (angularSeparationDeg(firstPlanet.lon, lastPlanet.lon) < CLUSTER_THRESHOLD_DEG) {
      clusters[0] = [...lastCluster, ...firstCluster];
      clusters.pop();
    }
  }

  for (const cluster of clusters) {
    const clusterSize = cluster.length;
    cluster.forEach((planet, clusterIndex) => {
      const shift = radialShiftForClusterIndex(clusterIndex, offset, clusterSize);
      radii.set(planet.key, clampRadius(baseRadius + shift, minRadius, maxRadius));
    });
  }

  return radii;
}

export function degreeTickStyle(deg: number, size: number): { len: number; strokeWidth: number } {
  if (deg % 30 === 0) return { len: size * 0.025, strokeWidth: 1 };
  if (deg % 10 === 0) return { len: size * 0.018, strokeWidth: 1 };
  if (deg % 5 === 0) return { len: size * 0.012, strokeWidth: 0.75 };
  return { len: size * 0.006, strokeWidth: 0.5 };
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
