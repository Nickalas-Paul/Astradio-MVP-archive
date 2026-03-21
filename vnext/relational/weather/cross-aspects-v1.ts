/**
 * Stage 7 — Transit × natal cross-aspects (pure geometry, same orbs as aspect-engine).
 */

import type { EphemerisSnapshot } from '../../contracts';
import { ASPECT_CONFIG, smallestArc, type AspectTypeKey } from '../../aspect-engine';
import { CORE_BODIES, type BodyKey } from '../../canonical-bodies';

const ASPECT_TYPE_ORDER: AspectTypeKey[] = [
  'conjunction',
  'opposition',
  'square',
  'trine',
  'sextile',
];

function aspectBaseWeight(type: AspectTypeKey): number {
  switch (type) {
    case 'conjunction':
      return 1.4;
    case 'opposition':
      return 1.35;
    case 'square':
      return 1.3;
    case 'trine':
      return 1.1;
    case 'sextile':
      return 1.05;
    default:
      return 1;
  }
}

function bodyPairWeight(name: string): number {
  const n = name.toLowerCase();
  if (n === 'sun' || n === 'moon') return 1.15;
  if (n === 'mercury') return 1.08;
  if (n === 'venus' || n === 'mars') return 1.06;
  if (n === 'jupiter' || n === 'saturn') return 1.0;
  if (n === 'uranus' || n === 'neptune' || n === 'pluto') return 1.12;
  return 1.0;
}

function lonByBody(snapshot: EphemerisSnapshot): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of snapshot.planets || []) {
    if (!p?.name || typeof p.lon !== 'number' || !Number.isFinite(p.lon)) continue;
    m.set(p.name.toLowerCase(), p.lon);
  }
  return m;
}

export type CrossAspectHitInternal = {
  transitBody: string;
  natalBody: string;
  memberChartId: string;
  type: AspectTypeKey;
  orbDeg: number;
  exactness: number;
  dynamics: (typeof ASPECT_CONFIG)[AspectTypeKey]['dynamics'];
  weight: number;
};

/**
 * For one member natal chart vs transit sky: all CORE_BODIES × CORE_BODIES cross hits.
 * Tie-break: smallest orb; then ASPECT_TYPE_ORDER.
 */
export function computeCrossAspectsForMember(
  transit: EphemerisSnapshot,
  natal: EphemerisSnapshot,
  memberChartId: string
): CrossAspectHitInternal[] {
  const tLon = lonByBody(transit);
  const nLon = lonByBody(natal);
  const hits: CrossAspectHitInternal[] = [];

  const bodies = [...CORE_BODIES] as BodyKey[];

  for (const tb of bodies) {
    const lt = tLon.get(tb);
    if (lt === undefined) continue;
    for (const nb of bodies) {
      const ln = nLon.get(nb);
      if (ln === undefined) continue;

      const exactAngle = smallestArc(lt, ln);
      const candidates: Array<{
        type: AspectTypeKey;
        orb: number;
        exactness: number;
        dynamics: CrossAspectHitInternal['dynamics'];
      }> = [];

      for (const type of ASPECT_TYPE_ORDER) {
        const cfg = ASPECT_CONFIG[type];
        const orb = Math.abs(exactAngle - cfg.angle);
        if (orb <= cfg.orb) {
          candidates.push({
            type,
            orb,
            exactness: 1 - orb / cfg.orb,
            dynamics: cfg.dynamics,
          });
        }
      }

      if (candidates.length === 0) continue;
      candidates.sort((a, b) => {
        if (a.orb !== b.orb) return a.orb - b.orb;
        return ASPECT_TYPE_ORDER.indexOf(a.type) - ASPECT_TYPE_ORDER.indexOf(b.type);
      });
      const best = candidates[0];

      const wAspect = aspectBaseWeight(best.type);
      const wBody = bodyPairWeight(tb) * bodyPairWeight(nb);
      const weight = best.exactness * wAspect * wBody;

      hits.push({
        transitBody: tb,
        natalBody: nb,
        memberChartId,
        type: best.type,
        orbDeg: Math.round(best.orb * 1000) / 1000,
        exactness: Math.round(best.exactness * 1000) / 1000,
        dynamics: best.dynamics,
        weight: Math.round(weight * 1000) / 1000,
      });
    }
  }

  return hits;
}
