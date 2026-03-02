#!/usr/bin/env node
/**
 * Phase 5 — Verify multi-chart compatibility engine.
 * No Postgres. Uses hardcoded vectors + computeMultiChartFromVectors.
 */

import {
  computeMultiChartFromVectors,
  MissingVectorsError,
  type MultiChartOutput,
} from '../relational/compatibility/multi-chart';
import { listIntentProfiles } from '../relational/intent-profiles';

function assertCheck(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-multi-chart] FAIL: ${msg}`);
    process.exit(1);
  }
}

function makeSampleVectors(): {
  chartIds: string[];
  vectors: Record<string, number[]>;
  encoders: Record<string, string>;
} {
  const chartIds = ['chart_a', 'chart_b', 'chart_c'];
  const base = new Array<number>(64).fill(0.5);

  const va = base.slice();
  va[27] = 0.7; // fire
  va[28] = 0.1;
  va[29] = 0.1;
  va[30] = 0.1;

  const vb = base.slice();
  vb[27] = 0.1;
  vb[28] = 0.7; // earth
  vb[29] = 0.1;
  vb[30] = 0.1;

  const vc = base.slice();
  vc[27] = 0.1;
  vc[28] = 0.1;
  vc[29] = 0.7; // air
  vc[30] = 0.1;

  const vectors: Record<string, number[]> = {
    chart_a: va,
    chart_b: vb,
    chart_c: vc,
  };
  const encoders: Record<string, string> = {
    chart_a: 'v1',
    chart_b: 'v1',
    chart_c: 'v1',
  };
  return { chartIds, vectors, encoders };
}

function assertMatrixSymmetry(out: MultiChartOutput): void {
  const m = out.compatibility_matrix;
  const n = m.length;
  assertCheck(n === out.chart_ids.length, 'matrix dimension must match chart_ids length');
  for (let i = 0; i < n; i++) {
    assertCheck(m[i][i] === 1, `diagonal must be 1.0 at (${i},${i})`);
    for (let j = i + 1; j < n; j++) {
      assertCheck(
        m[i][j] === m[j][i],
        `matrix must be symmetric at (${i},${j}) vs (${j},${i})`
      );
    }
  }
}

function assertAggregates(out: MultiChartOutput): void {
  const agg = out.aggregate_metrics;
  assertCheck(Number.isFinite(agg.mean_resonance), 'mean_resonance must be finite');
  assertCheck(Number.isFinite(agg.tension_variance), 'tension_variance must be finite');
  assertCheck(Number.isFinite(agg.stability_index), 'stability_index must be finite');
  assertCheck(
    agg.stability_index >= 0 && agg.stability_index <= 1,
    'stability_index must be in [0,1]'
  );
  assertCheck(
    ['fire', 'earth', 'air', 'water'].includes(agg.dominant_elemental_pattern),
    'dominant_elemental_pattern must be one of fire|earth|air|water'
  );
}

async function runVerify(): Promise<void> {
  console.log('[verify-multi-chart] Running multi-chart verification...');

  const profiles = listIntentProfiles();
  assertCheck(profiles.length > 0, 'At least one intent profile must exist');
  const profile = profiles[0];

  const { chartIds, vectors, encoders } = makeSampleVectors();

  // Deterministic output across runs
  const out1 = computeMultiChartFromVectors(chartIds, profile, vectors, encoders);
  const out2 = computeMultiChartFromVectors(chartIds, profile, vectors, encoders);
  const out3 = computeMultiChartFromVectors(chartIds, profile, vectors, encoders);

  const s1 = JSON.stringify(out1);
  const s2 = JSON.stringify(out2);
  const s3 = JSON.stringify(out3);
  assertCheck(s1 === s2 && s2 === s3, 'Output must be deterministic across runs');

  assertMatrixSymmetry(out1);
  assertAggregates(out1);

  // Fail-closed behavior: missing vector
  const missingVectors: Record<string, number[]> = {
    chart_a: vectors.chart_a,
    chart_b: vectors.chart_b,
    // chart_c intentionally omitted
  };

  let missingErrorOk = false;
  try {
    computeMultiChartFromVectors(chartIds, profile, missingVectors, encoders);
  } catch (e: unknown) {
    if (e instanceof MissingVectorsError) {
      missingErrorOk = Array.isArray(e.missing_chart_ids) && e.missing_chart_ids.includes('chart_c');
    }
  }
  assertCheck(missingErrorOk, 'Missing vector path must fail-closed with explicit error');

  console.log('[verify-multi-chart] All checks passed.');
  process.exit(0);
}

runVerify().catch((e) => {
  console.error('[verify-multi-chart]', e);
  process.exit(1);
});

export {};

