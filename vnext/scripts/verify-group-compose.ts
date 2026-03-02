#!/usr/bin/env node
/**
 * Phase 5 — Verify group composition adapter (up to payload/seed).
 * No Postgres, no external compose call.
 */

import { aggregateFeatureVectors } from '../community/group-profile';
import { vectorToControlPayload } from '../relational/composition/vector-to-controls';

function assertCheck(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-group-compose] FAIL: ${msg}`);
    process.exit(1);
  }
}

function makeSampleVectors(): { chartIds: string[]; vectors: Record<string, number[]> } {
  const chartIds = ['chart_g1', 'chart_g2', 'chart_g3'];
  const base = new Array<number>(64).fill(0.5);

  const v1 = base.slice();
  v1[27] = 0.7; // fire
  v1[28] = 0.1;
  v1[29] = 0.1;
  v1[30] = 0.1;
  v1[32] = 0.6;

  const v2 = base.slice();
  v2[27] = 0.2;
  v2[28] = 0.6; // earth
  v2[29] = 0.1;
  v2[30] = 0.1;
  v2[32] = 0.4;

  const v3 = base.slice();
  v3[27] = 0.2;
  v3[28] = 0.2;
  v3[29] = 0.5; // air
  v3[30] = 0.1;
  v3[32] = 0.5;

  const vectors: Record<string, number[]> = {
    chart_g1: v1,
    chart_g2: v2,
    chart_g3: v3,
  };
  return { chartIds, vectors };
}

// Local hash for verification only; mirrors hashVector64 behavior (64 dims, 6 decimals).
function hashVectorForTest(vec: number[]): string {
  const crypto = require('crypto') as typeof import('crypto');
  const arr = vec.length >= 64 ? vec : new Array(64).fill(0);
  const str = Array.from(arr)
    .slice(0, 64)
    .map((x) => (Number.isFinite(x) ? (x as number).toFixed(6) : '0'))
    .join(',');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

async function runVerify(): Promise<void> {
  console.log('[verify-group-compose] Running group compose verification...');

  const { chartIds, vectors } = makeSampleVectors();
  const orderedIds = [...chartIds].sort((a, b) => a.localeCompare(b, 'en'));
  const memberVecs = orderedIds.map((id) => vectors[id]);

  const composite = aggregateFeatureVectors(memberVecs, 'mean_normalized');
  const vectorHashes: Record<string, string> = {};
  for (const id of orderedIds) {
    vectorHashes[id] = hashVectorForTest(vectors[id]);
  }

  const sortedHashes = [...Object.values(vectorHashes)].sort();
  const seedPayload = `group_compose_v1|test_group|${orderedIds.join(',')}|${sortedHashes.join(',')}`;
  const crypto = await import('crypto');
  const seed = crypto.createHash('sha256').update(seedPayload, 'utf8').digest('hex');

  const p1 = vectorToControlPayload(composite, seed);
  const p2 = vectorToControlPayload(composite, seed);
  const p3 = vectorToControlPayload(composite, seed);

  const s1 = JSON.stringify(p1);
  const s2 = JSON.stringify(p2);
  const s3 = JSON.stringify(p3);
  assertCheck(s1 === s2 && s2 === s3, 'vectorToControlPayload must be deterministic');

  assertCheck(
    typeof p1.hash === 'string' && p1.hash === seed,
    'payload.hash must equal seed'
  );
  assertCheck(
    ['fire', 'earth', 'air', 'water'].includes(p1.element_dominance),
    'element_dominance must be a valid element label'
  );
  assertCheck(
    p1.aspect_tension >= 0 && p1.aspect_tension <= 1,
    'aspect_tension must be in [0,1]'
  );

  console.log('[verify-group-compose] All checks passed.');
  process.exit(0);
}

runVerify().catch((e) => {
  console.error('[verify-group-compose]', e);
  process.exit(1);
});

export {};

