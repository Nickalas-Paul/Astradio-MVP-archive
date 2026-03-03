// vnext/rpg/hash/snapshot-hash.ts
// Deterministic hashing for EphemerisSnapshot, independent of key ordering.

import type { EphemerisSnapshot } from '../../contracts';
import { canonicalJsonString, sha256Hex } from './json-hash';
import type { TransitHash } from '../contracts';

export function hashSnapshot(snapshot: EphemerisSnapshot): TransitHash {
  const json = canonicalJsonString(snapshot);
  const digest = sha256Hex('snapshot:' + json);
  return digest as TransitHash;
}

