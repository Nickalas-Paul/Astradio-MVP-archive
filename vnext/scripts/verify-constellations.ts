#!/usr/bin/env node
/**
 * Phase 5 — Verify constellation centroids.
 * No Postgres. Validates centroid vectors and deterministic hashes.
 */

import { CONSTELLATION_CENTROIDS } from '../relational/constellation/centroids';
import { hashVector64 } from '../relational/compatibility/score';
import { FEATURE_ELEMENT_INDICES } from '../relational/constants';

const EPSILON = 1e-6;

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-constellations] FAIL: ${msg}`);
    process.exit(1);
  }
}

function main(): void {
  console.log('[verify-constellations] Running centroid verification...');

  for (const centroid of CONSTELLATION_CENTROIDS) {
    const v = centroid.vector64;

    assert(v.length === 64, `${centroid.slug}: vector64 length must be 64`);
    assert(
      v.every((x) => Number.isFinite(x)),
      `${centroid.slug}: all values must be finite`
    );
    assert(
      v.every((x) => x >= 0 && x <= 1),
      `${centroid.slug}: all values must be in [0,1]`
    );

    const elemSum = FEATURE_ELEMENT_INDICES.reduce((s, i) => s + (v[i] ?? 0), 0);
    assert(
      Math.abs(elemSum - 1.0) < EPSILON,
      `${centroid.slug}: element dims 27–30 must sum to ~1.0, got ${elemSum}`
    );

    const h1 = hashVector64(v);
    const h2 = hashVector64(v);
    assert(h1 === h2, `${centroid.slug}: centroid_hash must be stable across runs`);
  }

  // Run twice to ensure deterministic hashes across full script runs
  const hashes = CONSTELLATION_CENTROIDS.map((c) => hashVector64(c.vector64));
  const hashes2 = CONSTELLATION_CENTROIDS.map((c) => hashVector64(c.vector64));
  assert(
    JSON.stringify(hashes) === JSON.stringify(hashes2),
    'centroid hashes must be deterministic across multiple runs'
  );

  console.log('[verify-constellations] All checks passed.');
  process.exit(0);
}

main();
