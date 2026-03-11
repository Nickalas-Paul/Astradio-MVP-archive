/**
 * Phase 8H — Deterministic aspect prioritization.
 * Ranking layer only: no prose, no product-surface language.
 * Use for Sandbox summaries, reporting, compatibility, campaign/RPG surfacing.
 */

import { bodyOrderIndex } from './canonical-bodies';

export type AspectTypeKey = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

/** Aspect with optional Phase 8H metadata. Reads bodyA/bodyB (or legacy a/b). */
export type AspectWithMeta = {
  bodyA?: string;
  bodyB?: string;
  a?: string;
  b?: string;
  type: AspectTypeKey | string;
  orb?: number;
  exactAngle?: number;
  dynamics?: string;
  strength?: number;
  exactness?: number;
  priorityBase?: number;
};

const ASPECT_TYPE_ORDER: Record<string, number> = {
  conjunction: 0,
  opposition: 1,
  square: 2,
  trine: 3,
  sextile: 4,
};

function bodyA(asp: AspectWithMeta): string {
  return (asp.bodyA ?? asp.a ?? '').toLowerCase();
}
function bodyB(asp: AspectWithMeta): string {
  return (asp.bodyB ?? asp.b ?? '').toLowerCase();
}

/**
 * Deterministic comparator: higher priority first.
 * Tiebreakers: exactness (higher), strength (higher), body order (lower combined index), type order.
 */
export function compareAspects(a: AspectWithMeta, b: AspectWithMeta): number {
  const pa = typeof a.priorityBase === 'number' ? a.priorityBase : 0;
  const pb = typeof b.priorityBase === 'number' ? b.priorityBase : 0;
  if (pb !== pa) return pb - pa;

  const exA = typeof a.exactness === 'number' ? a.exactness : 0;
  const exB = typeof b.exactness === 'number' ? b.exactness : 0;
  if (exB !== exA) return exB - exA;

  const strA = typeof a.strength === 'number' ? a.strength : 0;
  const strB = typeof b.strength === 'number' ? b.strength : 0;
  if (strB !== strA) return strB - strA;

  const orderA = bodyOrderIndex(bodyA(a)) + bodyOrderIndex(bodyB(a));
  const orderB = bodyOrderIndex(bodyA(b)) + bodyOrderIndex(bodyB(b));
  if (orderA !== orderB) return orderA - orderB;

  const minA = Math.min(bodyOrderIndex(bodyA(a)), bodyOrderIndex(bodyB(a)));
  const minB = Math.min(bodyOrderIndex(bodyA(b)), bodyOrderIndex(bodyB(b)));
  if (minA !== minB) return minA - minB;

  const typeA = ASPECT_TYPE_ORDER[a.type] ?? 99;
  const typeB = ASPECT_TYPE_ORDER[b.type] ?? 99;
  if (typeA !== typeB) return typeA - typeB;

  const strCmp = bodyA(a).localeCompare(bodyA(b));
  if (strCmp !== 0) return strCmp;
  return bodyB(a).localeCompare(bodyB(b));
}

/**
 * Sort aspects by priority (deterministic). Same inputs → same order.
 */
export function sortAspectsByPriority<T extends AspectWithMeta>(aspects: T[]): T[] {
  return aspects.slice().sort(compareAspects);
}

/**
 * Return top N aspects by priority. Deterministic; stable for ties.
 */
export function topRankedAspects<T extends AspectWithMeta>(aspects: T[], n: number): T[] {
  return sortAspectsByPriority(aspects).slice(0, Math.max(0, n));
}
