export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function wheelEclipticDeg(lonDeg: number, ascendantDeg: number): number {
  return normalizeDeg(lonDeg - ascendantDeg);
}

export function pol(
  radius: number,
  eclipticLon: number,
  ascendantDeg: number
): { x: number; y: number } {
  const wheelDeg = wheelEclipticDeg(eclipticLon, ascendantDeg);
  const angle = ((-wheelDeg + 180) * Math.PI) / 180;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

export function angularSeparationDeg(lonA: number, lonB: number): number {
  const delta = Math.abs(normalizeDeg(lonA) - normalizeDeg(lonB));
  return delta > 180 ? 360 - delta : delta;
}

/** Zodiac sign ring segment (30° ecliptic slice). signIndex 0 = Aries. */
export function zodiacSegmentPath(
  outerRadius: number,
  innerRadius: number,
  signIndex: number,
  ascendantDeg: number
): string {
  const startLon = signIndex * 30;
  const endLon = startLon + 30;
  return arcPath(outerRadius, innerRadius, startLon, endLon, ascendantDeg);
}

export function arcPath(
  outerRadius: number,
  innerRadius: number,
  cuspLon0: number,
  cuspLon1: number,
  ascendantDeg: number
): string {
  const w0 = wheelEclipticDeg(cuspLon0, ascendantDeg);
  const w1 = wheelEclipticDeg(cuspLon1, ascendantDeg);
  const span = ((w1 - w0 + 360) % 360) || 360;
  const wEnd = (w0 + span) % 360;
  const rad0 = ((-w0 + 180) * Math.PI) / 180;
  const rad1 = ((-wEnd + 180) * Math.PI) / 180;
  const p0 = { x: outerRadius * Math.cos(rad0), y: outerRadius * Math.sin(rad0) };
  const p1 = { x: outerRadius * Math.cos(rad1), y: outerRadius * Math.sin(rad1) };
  const p2 = { x: innerRadius * Math.cos(rad1), y: innerRadius * Math.sin(rad1) };
  const p3 = { x: innerRadius * Math.cos(rad0), y: innerRadius * Math.sin(rad0) };
  const large = span > 180 ? 1 : 0;
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${large} 0 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${large} 1 ${p3.x} ${p3.y}`,
    'Z',
  ].join(' ');
}

/** Matches apps/web WheelSvgCore technical-mode radii (size = SVG width/height). */
export function wheelRadii(size: number) {
  const R_ZODIAC = size / 2 - 4;
  const R_OUT = R_ZODIAC - size * 0.08;
  const R_IN = R_OUT * 0.6;
  return {
    R_ZODIAC,
    R_OUT,
    R_IN,
    planetRadius: R_OUT - 10,
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
