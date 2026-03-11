/**
 * Phase 8H — Report intake: normalized relational chart structure for text/reporting.
 * Merges placements, houses, aspects, and ranked aspect summary.
 * No prose; structural only. Use so reporting is not placement-only.
 */

import type { EphemerisSnapshot, SnapshotAspect } from './contracts';
import { topRankedAspects, type AspectWithMeta } from './aspect-priority';

const DEFAULT_TOP_ASPECTS = 10;

export interface RelationalChartContext {
  /** Body names present in snapshot (expanded set). */
  bodies: string[];
  /** All aspects from snapshot (bodyA, bodyB, type, orb, dynamics, strength, exactness, priorityBase). */
  aspects: SnapshotAspect[];
  /** Top N aspects by priority (deterministic). */
  topAspects: SnapshotAspect[];
  /** Whether aspect data exists and is non-empty. */
  hasAspectData: boolean;
  /** House cusps (12). */
  houses: number[];
}

/**
 * Build report context from snapshot for use by text/reporting layer.
 * Answers: what bodies exist, what aspects exist, which aspects are strongest, what their dynamics are.
 */
export function buildRelationalChartContext(
  snapshot: EphemerisSnapshot,
  topN: number = DEFAULT_TOP_ASPECTS
): RelationalChartContext {
  const bodies = (snapshot.planets ?? []).map((p) => p.name);
  const aspects = (snapshot.aspects ?? []) as SnapshotAspect[];
  const withMeta = aspects as AspectWithMeta[];
  const topAspects = topRankedAspects(withMeta, topN) as SnapshotAspect[];
  const hasAspectData = aspects.length > 0;
  const houses = (snapshot.houses ?? []).slice(0, 12);

  return {
    bodies,
    aspects,
    topAspects,
    hasAspectData,
    houses,
  };
}
