/**
 * Phase 8H — Deterministic aspect calculation for chart state.
 * Uses zodiac longitude only; supports all bodies in the canonical registry.
 * Machine-readable metadata only (dynamics, strength, exactness, priorityBase).
 */

import { bodyOrderIndex } from './canonical-bodies';

export type AspectTypeKey = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

/** Exported for Stage 7 cross-chart (transit×natal) aspect detection — keep in sync with computeAspects. */
export const ASPECT_CONFIG: Record<
  AspectTypeKey,
  { angle: number; orb: number; dynamics: 'amplifying' | 'supportive' | 'tense' | 'flowing' | 'polarizing' }
> = {
  conjunction: { angle: 0, orb: 8, dynamics: 'amplifying' },
  sextile: { angle: 60, orb: 4, dynamics: 'supportive' },
  square: { angle: 90, orb: 6, dynamics: 'tense' },
  trine: { angle: 120, orb: 6, dynamics: 'flowing' },
  opposition: { angle: 180, orb: 8, dynamics: 'polarizing' },
};

export interface AspectResult {
  bodyA: string;
  bodyB: string;
  type: AspectTypeKey;
  orb: number;
  exactAngle: number;
  dynamics: 'amplifying' | 'supportive' | 'tense' | 'flowing' | 'polarizing';
  strength: number;
  exactness: number;
  priorityBase: number;
}

/**
 * Normalize angular difference to smallest arc [0, 180].
 */
export function smallestArc(lon1: number, lon2: number): number {
  let d = Math.abs(((lon1 % 360) - (lon2 % 360) + 360) % 360);
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Compute deterministic aspects for all body pairs in positions.
 * Uses orb thresholds: conjunction 8°, sextile 4°, square 6°, trine 6°, opposition 8°.
 */
export function computeAspects(positions: Record<string, number>): AspectResult[] {
  const bodies = Object.keys(positions).filter((k) => Number.isFinite(positions[k]));
  const results: AspectResult[] = [];

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const bodyA = bodies[i];
      const bodyB = bodies[j];
      const lon1 = positions[bodyA];
      const lon2 = positions[bodyB];
      const exactAngle = smallestArc(lon1, lon2);

      for (const [type, config] of Object.entries(ASPECT_CONFIG)) {
        const orb = Math.abs(exactAngle - config.angle);
        if (orb <= config.orb) {
          const exactness = 1 - orb / config.orb;
          const strength = Math.max(0, Math.min(1, exactness));
          const orderA = bodyOrderIndex(bodyA);
          const orderB = bodyOrderIndex(bodyB);
          const importance = 1 - (orderA + orderB) / (2 * 20);
          const priorityBase = Math.max(0, Math.min(1, exactness * 0.7 + importance * 0.3));

          results.push({
            bodyA,
            bodyB,
            type: type as AspectTypeKey,
            orb,
            exactAngle,
            dynamics: config.dynamics,
            strength: Math.round(strength * 100) / 100,
            exactness: Math.round(exactness * 100) / 100,
            priorityBase: Math.round(priorityBase * 100) / 100,
          });
        }
      }
    }
  }

  return results.sort((a, b) => b.priorityBase - a.priorityBase);
}

/** Snapshot aspect shape with Phase 8H metadata. Canonical: bodyA, bodyB. */
export type SnapshotAspectItem = {
  bodyA: string;
  bodyB: string;
  type: AspectTypeKey;
  orb: number;
  exactAngle?: number;
  dynamics?: 'amplifying' | 'supportive' | 'tense' | 'flowing' | 'polarizing';
  strength?: number;
  exactness?: number;
  priorityBase?: number;
  motion?: 'applying' | 'separating';
};

/**
 * Convert AspectResult[] to EphemerisSnapshot aspect shape (bodyA, bodyB, type, orb + metadata).
 */
export function toSnapshotAspects(aspects: AspectResult[]): SnapshotAspectItem[] {
  return aspects.map((x) => ({
    bodyA: x.bodyA,
    bodyB: x.bodyB,
    type: x.type,
    orb: x.orb,
    exactAngle: x.exactAngle,
    dynamics: x.dynamics,
    strength: x.strength,
    exactness: x.exactness,
    priorityBase: x.priorityBase,
  }));
}
