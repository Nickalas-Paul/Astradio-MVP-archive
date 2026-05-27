/** Polar offset from wheel center (post-translate group). */
export function pol(r: number, eclDeg: number): { x: number; y: number } {
  const a = ((-eclDeg + 180) * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

export function arcPath(r1: number, r2: number, a0: number, a1: number): string {
  const span = ((a1 - a0 + 360) % 360) || 360;
  const p0 = pol(r1, a0);
  const p1 = pol(r1, a1);
  const p2 = pol(r2, a1);
  const p3 = pol(r2, a0);
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

export function angleToLonDeg(angleRad: number): number {
  let lonDeg = (-angleRad * 180) / Math.PI + 180;
  while (lonDeg < 0) lonDeg += 360;
  while (lonDeg >= 360) lonDeg -= 360;
  return roundDegree(lonDeg);
}
