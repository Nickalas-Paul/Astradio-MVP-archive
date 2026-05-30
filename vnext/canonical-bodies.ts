/**
 * Phase 8H — Canonical supported-body contract.
 * Single source of truth for all snapshot-derived surfaces.
 * No surface should maintain its own silent body subset unless explicitly product-scoped and documented.
 */

/** Core 10 + North Node + Chiron, Ceres, Pallas, Juno, Vesta */
export const SUPPORTED_BODIES = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'northNode',
  'chiron',
  'ceres',
  'pallas',
  'juno',
  'vesta',
] as const;

export type BodyKey = (typeof SUPPORTED_BODIES)[number];

/** Core 10 only (classic planet set). */
export const CORE_BODIES = SUPPORTED_BODIES.slice(0, 10) as unknown as readonly BodyKey[];

/** Additional bodies promoted in Phase 8H. */
export const ADDITIONAL_BODIES = ['chiron', 'ceres', 'pallas', 'juno', 'vesta'] as const;

export type AdditionalBodyKey = (typeof ADDITIONAL_BODIES)[number];

/** Display order for UI and serialization. */
export const BODY_DISPLAY_ORDER: readonly BodyKey[] = SUPPORTED_BODIES;

/** Human-readable labels (sentence case). */
export const BODY_LABELS: Record<BodyKey, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
  northNode: 'North Node',
  chiron: 'Chiron',
  ceres: 'Ceres',
  pallas: 'Pallas',
  juno: 'Juno',
  vesta: 'Vesta',
};

/** Body index in display order (0–14). Used for deterministic priorityBase. */
export function bodyOrderIndex(body: string): number {
  const i = SUPPORTED_BODIES.indexOf(body.toLowerCase() as BodyKey);
  return i >= 0 ? i : 999;
}

export function isSupportedBody(name: string): name is BodyKey {
  return SUPPORTED_BODIES.includes(name.toLowerCase() as BodyKey);
}
