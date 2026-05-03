/**
 * Shared directed cross-chart aspect geometry for:
 * - compatibility scoring (`computePairSignals` in build-relational-field.ts)
 * - synastry projection (`synastry-compute.ts`)
 *
 * Single orb policy: ASPECT_CONFIG + smallestArc; best-type selection matches legacy scoring:
 * minimize orb distance to ideal angle; tie-break by ASPECT_TYPE_ORDER index (earlier wins).
 */

import { ASPECT_CONFIG, smallestArc, type AspectTypeKey } from '../aspect-engine';

/** Matches historical order in build-relational-field `computePairSignals`. */
export const ASPECT_TYPE_ORDER_CROSS_CHART: AspectTypeKey[] = [
  'conjunction',
  'opposition',
  'square',
  'trine',
  'sextile',
];

export type DirectedCrossAspectHit = {
  readonly type: AspectTypeKey;
  /** Absolute difference between smallest arc and ideal angle (degrees). */
  readonly orb: number;
  readonly exactness: number;
  readonly exactAngle: number;
};

/**
 * Given two longitudes (first body on source chart, second on target chart), return the single
 * best-matching aspect type under ASPECT_CONFIG, or null if no type is within orb.
 */
export function findBestDirectedCrossAspect(lonSource: number, lonTarget: number): DirectedCrossAspectHit | null {
  const exactAngle = smallestArc(lonSource, lonTarget);
  let best: DirectedCrossAspectHit | null = null;
  for (const type of ASPECT_TYPE_ORDER_CROSS_CHART) {
    const cfg = ASPECT_CONFIG[type];
    const orb = Math.abs(exactAngle - cfg.angle);
    if (orb > cfg.orb) continue;
    const exactness = 1 - orb / cfg.orb;
    const candidate: DirectedCrossAspectHit = { type, orb, exactness, exactAngle };
    if (
      !best ||
      candidate.orb < best.orb ||
      (candidate.orb === best.orb &&
        ASPECT_TYPE_ORDER_CROSS_CHART.indexOf(candidate.type) <
          ASPECT_TYPE_ORDER_CROSS_CHART.indexOf(best.type))
    ) {
      best = candidate;
    }
  }
  return best;
}
