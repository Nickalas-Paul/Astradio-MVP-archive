/**
 * Transit body → base encounter damage.
 */

const BODY_DAMAGE: Record<string, number> = {
  mars: 8,
  saturn: 10,
  pluto: 12,
  uranus: 9,
  neptune: 6,
  jupiter: 4,
  mercury: 5,
  venus: 3,
  sun: 6,
  moon: 5,
};

const DEFAULT_DAMAGE = 6;

export function transitBodyCategory(transitBody: string): string {
  return String(transitBody || 'sun').trim().toLowerCase();
}

export function baseDamageForTransitBody(transitBody: string): number {
  const key = transitBodyCategory(transitBody);
  return BODY_DAMAGE[key] ?? DEFAULT_DAMAGE;
}

/** Subtract floor(resilience / 4); minimum 1 damage before half/double multipliers. */
export function resilienceDamageReduction(resilience: number): number {
  return Math.floor(Math.max(0, resilience) / 4);
}
