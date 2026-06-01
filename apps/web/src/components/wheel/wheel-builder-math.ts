import { BODY_DISPLAY_ORDER } from '../../../../../vnext/canonical-bodies';
import type { PlanetKey } from '../../types/sandbox';
import { angleToLonDeg, roundDegree } from './wheel-geometry';

export const PLANET_ORDER: PlanetKey[] = [...BODY_DISPLAY_ORDER] as PlanetKey[];

export function getPlanetAtPoint(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radius: number,
  positions: Record<string, number>,
  ascendantDeg: number = 0,
  hitRadius: number = 15
): PlanetKey | null {
  const dx = x - centerX;
  const dy = y - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > radius - hitRadius && dist < radius + hitRadius) {
    const angle = Math.atan2(dy, dx);
    const clickLon = angleToLonDeg(angle, ascendantDeg);

    let closest: PlanetKey | null = null;
    let minDist = Infinity;

    for (const planet of PLANET_ORDER) {
      const planetLon = positions[planet];
      if (planetLon === undefined) continue;

      let d = Math.abs(clickLon - planetLon);
      if (d > 180) d = 360 - d;

      if (d < minDist && d < 10) {
        minDist = d;
        closest = planet;
      }
    }

    return closest;
  }

  return null;
}

export function houseIndexForLongitude(lonDeg: number, cusps: number[]): number {
  if (cusps.length < 12) return 0;
  const lon = ((lonDeg % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const inRange = end > start ? lon >= start && lon < end : lon >= start || lon < end;
    if (inRange) return i;
  }
  return 0;
}

export function clampToHouse(lonDeg: number, houseIndex: number, cusps: number[]): number {
  if (cusps.length < 12) return roundDegree(lonDeg);
  const start = cusps[houseIndex];
  const end = cusps[(houseIndex + 1) % 12];
  const lon = ((lonDeg % 360) + 360) % 360;
  const inRange =
    end > start ? lon >= start && lon < end : lon >= start || lon < end;
  if (inRange) return roundDegree(lonDeg);
  const distToStart = start <= lon ? lon - start : lon + (360 - start);
  const distToEnd = end >= lon ? end - lon : 360 - lon + end;
  const clamped = distToStart <= distToEnd ? start : end;
  return roundDegree(clamped === 360 ? 0 : clamped);
}
