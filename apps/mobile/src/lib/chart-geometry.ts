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

const CLUSTER_THRESHOLD_DEG = 8;

export function clusterPlanetRadii(
  planets: Array<{ key: string; lon: number }>,
  baseRadius: number,
  size: number
): Map<string, number> {
  const sorted = [...planets].sort((a, b) => a.lon - b.lon);
  const radii = new Map<string, number>();
  const offset = size * 0.025;
  let clusterIndex = 0;
  let prevLon: number | null = null;

  for (const planet of sorted) {
    if (prevLon == null || angularSeparationDeg(planet.lon, prevLon) >= CLUSTER_THRESHOLD_DEG) {
      clusterIndex = 0;
    } else {
      clusterIndex += 1;
    }

    const radialShift = clusterIndex === 0 ? 0 : clusterIndex % 2 === 1 ? -offset : offset;
    radii.set(planet.key, baseRadius + radialShift);
    prevLon = planet.lon;
  }

  return radii;
}

export function degreeTickStyle(deg: number, size: number): { len: number; strokeWidth: number } {
  if (deg % 30 === 0) return { len: size * 0.025, strokeWidth: 1 };
  if (deg % 10 === 0) return { len: size * 0.018, strokeWidth: 1 };
  if (deg % 5 === 0) return { len: size * 0.012, strokeWidth: 0.75 };
  return { len: size * 0.006, strokeWidth: 0.5 };
}
