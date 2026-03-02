#!/usr/bin/env node
/**
 * Phase 5 — Verify intent-weighted scoring.
 * No Postgres. Uses hardcoded sample vectors.
 * Asserts: facet breakdown finite, determinism, different profiles yield different scores.
 */

import {
  computeFacetBreakdown,
  scoreWithIntent,
  hashVector64,
  compareCompatResults,
} from '../relational/compatibility/score';
import { getIntentProfileBySlug } from '../relational/intent-profiles';

// Two fixed 64-D sample vectors. Element dims 27-30 (fire,earth,air,water), tension 32. See vnext/relational/constants.ts.
const SAMPLE_VEC_A: number[] = new Array(64).fill(0);
SAMPLE_VEC_A[27] = 0.8; // fire
SAMPLE_VEC_A[28] = 0.1; // earth
SAMPLE_VEC_A[29] = 0.05; // air
SAMPLE_VEC_A[30] = 0.05; // water
SAMPLE_VEC_A[32] = 0.3; // tension
SAMPLE_VEC_A[33] = 0.6; // cluster
SAMPLE_VEC_A[44] = 0.5;
SAMPLE_VEC_A[45] = 0.5;
SAMPLE_VEC_A[46] = 0.5;
SAMPLE_VEC_A[47] = 0.5;

const SAMPLE_VEC_B: number[] = new Array(64).fill(0);
SAMPLE_VEC_B[27] = 0.7; // fire
SAMPLE_VEC_B[28] = 0.15; // earth
SAMPLE_VEC_B[29] = 0.1; // air
SAMPLE_VEC_B[30] = 0.05; // water
SAMPLE_VEC_B[32] = 0.35; // tension - close to A
SAMPLE_VEC_B[33] = 0.5;
SAMPLE_VEC_B[44] = 0.6;
SAMPLE_VEC_B[45] = 0.4;
SAMPLE_VEC_B[46] = 0.6;
SAMPLE_VEC_B[47] = 0.4;

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-intent-scoring] FAIL: ${msg}`);
    process.exit(1);
  }
}

function main(): void {
  console.log('[verify-intent-scoring] Running intent-weighted scoring verification...');

  const breakdown = computeFacetBreakdown(SAMPLE_VEC_A, SAMPLE_VEC_B);
  assert(Number.isFinite(breakdown.overall), 'overall must be finite');
  assert(Number.isFinite(breakdown.elemental), 'elemental must be finite');
  assert(Number.isFinite(breakdown.tension), 'tension must be finite');
  assert(Number.isFinite(breakdown.preference), 'preference must be finite');
  assert(breakdown.overall >= 0 && breakdown.overall <= 1, 'overall in [0,1]');
  assert(breakdown.elemental >= 0 && breakdown.elemental <= 1, 'elemental in [0,1]');
  assert(breakdown.tension >= 0 && breakdown.tension <= 1, 'tension in [0,1]');
  assert(breakdown.preference >= 0 && breakdown.preference <= 1, 'preference in [0,1]');

  const profileRomantic = getIntentProfileBySlug('romantic');
  const profileTension = getIntentProfileBySlug('oppositional_catalyst');

  const run1 = scoreWithIntent(SAMPLE_VEC_A, SAMPLE_VEC_B, profileRomantic);
  const run2 = scoreWithIntent(SAMPLE_VEC_A, SAMPLE_VEC_B, profileRomantic);
  assert(run1.score === run2.score, 'Score must be deterministic across runs');
  assert(Number.isFinite(run1.score), 'score must be finite');

  const runTension = scoreWithIntent(SAMPLE_VEC_A, SAMPLE_VEC_B, profileTension);
  // Different weights => likely different score (oppositional_catalyst weights tension 0.4 vs romantic 0.15)
  const scoresDiffer = run1.score !== runTension.score;
  assert(scoresDiffer, 'Different intent profiles should yield different scores');

  const ha = hashVector64(SAMPLE_VEC_A);
  const hb = hashVector64(SAMPLE_VEC_B);
  assert(ha.length === 64 && /^[a-f0-9]+$/.test(ha), 'vector_hash_a must be 64-char hex');
  assert(hb.length === 64 && /^[a-f0-9]+$/.test(hb), 'vector_hash_b must be 64-char hex');
  const ha2 = hashVector64(SAMPLE_VEC_A);
  assert(ha === ha2, 'hashVector64 must be deterministic');

  const a = { score: 0.7, vector_hash: 'a', chart_id: 'chart_2' };
  const b = { score: 0.7, vector_hash: 'b', chart_id: 'chart_1' };
  assert(compareCompatResults(a, b) < 0, 'compare: same score, vector_hash asc => a before b');
  const c = { score: 0.8, vector_hash: 'z', chart_id: 'chart_9' };
  assert(compareCompatResults(c, a) < 0, 'compare: higher score first');

  console.log('[verify-intent-scoring] All checks passed.');
  process.exit(0);
}

main();
