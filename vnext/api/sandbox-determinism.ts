/**
 * Command-center: canonical identity versioning for composition / sandbox inputs.
 * Bump when hashing or normalization rules change materially.
 */
/** Bumped for per-slot override fingerprints, UI-order aggregates, mixed chart_id/birth multi-slot. */
export const CANONICAL_INPUT_HASH_VERSION = 3;

/** Serialize a finite number for hashing without rounding or truncation (JSON is stable for IEEE doubles in practice). */
export function serializeNumberForHash(n: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error('serializeNumberForHash: finite number required');
  }
  return JSON.stringify(n);
}
