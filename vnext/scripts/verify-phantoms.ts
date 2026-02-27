#!/usr/bin/env node
/**
 * Phase 5 — Verify phantom transforms.
 * No Postgres. Uses hardcoded sample vector.
 */

import { applyPhantomTransform } from '../relational/phantom/transforms';
import { PHANTOM_PROFILES } from '../relational/phantom/profiles';

const SAMPLE_BASE: number[] = new Array(64).fill(0);
SAMPLE_BASE[27] = 0.6; // fire
SAMPLE_BASE[28] = 0.2; // earth
SAMPLE_BASE[29] = 0.1; // air
SAMPLE_BASE[30] = 0.1; // water
SAMPLE_BASE[32] = 0.4; // tension

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-phantoms] FAIL: ${msg}`);
    process.exit(1);
  }
}

function main(): void {
  console.log('[verify-phantoms] Running phantom transform verification...');

  for (const profile of PHANTOM_PROFILES) {
    const r1 = applyPhantomTransform(SAMPLE_BASE, profile);
    const r2 = applyPhantomTransform(SAMPLE_BASE, profile);

    assert(r1.phantomVec.length === 64, `${profile.slug}: phantomVec length must be 64`);
    assert(
      r1.phantomVec.every((x) => Number.isFinite(x)),
      `${profile.slug}: all values must be finite`
    );
    assert(
      r1.phantomVec.every((x) => x >= 0 && x <= 1),
      `${profile.slug}: all values must be in [0,1]`
    );
    assert(r1.phantom_hash === r2.phantom_hash, `${profile.slug}: hash must be stable across runs`);
    assert(r1.transform_version === profile.version, `${profile.slug}: transform_version must match`);
  }

  console.log('[verify-phantoms] All checks passed.');
  process.exit(0);
}

main();
