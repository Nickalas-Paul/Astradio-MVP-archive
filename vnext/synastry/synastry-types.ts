/**
 * Phase 6C — directed cross-chart aspects (slot indices) for seeker-anchored synastry assembly.
 */

import type { SnapshotAspect } from '../contracts';

/** `SnapshotAspect` row with explicit source/target participant slots from synastry compute. */
export type DirectedSnapshotAspect = SnapshotAspect & {
  readonly sourceSlotIndex: number;
  readonly targetSlotIndex: number;
};

/** UI seeker (Chart A) vs target (Chart B) mapped onto canonical participant slot order (lexical low/high). */
export type ComparisonSeekerContextV1 = {
  readonly seekerChartId: string;
  readonly targetChartId: string;
  readonly seekerSlotIndex: number;
  readonly targetSlotIndex: number;
};

/** Strip directional fields for legacy `pair_interaction_aspects` digest compatibility. */
export function toLegacyPairInteractionAspect(d: DirectedSnapshotAspect): SnapshotAspect {
  return {
    bodyA: d.bodyA,
    bodyB: d.bodyB,
    type: d.type,
    orb: d.orb,
    exactAngle: d.exactAngle,
    dynamics: d.dynamics,
    strength: d.strength,
    exactness: d.exactness,
    priorityBase: d.priorityBase,
    motion: d.motion,
  };
}
