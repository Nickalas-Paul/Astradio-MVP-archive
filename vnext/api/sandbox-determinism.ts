/**
 * Command-center: canonical identity versioning for composition / sandbox inputs.
 * Bump when hashing or normalization rules change materially.
 */
/** Bumped v4: `commit_relational_classification` on normalized composition body (was v3: mixed aggregates). */
export const CANONICAL_INPUT_HASH_VERSION = 4;

/** Serialize a finite number for hashing without rounding or truncation (JSON is stable for IEEE doubles in practice). */
export function serializeNumberForHash(n: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error('serializeNumberForHash: finite number required');
  }
  return JSON.stringify(n);
}
