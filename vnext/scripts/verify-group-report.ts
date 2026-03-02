#!/usr/bin/env node
/**
 * Phase 5 — Verify group report generation.
 * No Postgres. Uses multi-chart-from-vectors path.
 */

import {
  computeMultiChartFromVectors,
} from '../relational/compatibility/multi-chart';
import { listIntentProfiles } from '../relational/intent-profiles';
import { buildGroupReport } from '../relational/reports/group-report';

function assertCheck(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-group-report] FAIL: ${msg}`);
    process.exit(1);
  }
}

function makeSampleVectors(): {
  chartIds: string[];
  vectors: Record<string, number[]>;
} {
  const chartIds = ['chart_r1', 'chart_r2', 'chart_r3'];
  const base = new Array<number>(64).fill(0.5);

  const v1 = base.slice();
  v1[27] = 0.7;
  v1[28] = 0.1;
  v1[29] = 0.1;
  v1[30] = 0.1;
  v1[32] = 0.6;

  const v2 = base.slice();
  v2[27] = 0.2;
  v2[28] = 0.6;
  v2[29] = 0.1;
  v2[30] = 0.1;
  v2[32] = 0.4;

  const v3 = base.slice();
  v3[27] = 0.2;
  v3[28] = 0.2;
  v3[29] = 0.5;
  v3[30] = 0.1;
  v3[32] = 0.5;

  const vectors: Record<string, number[]> = {
    chart_r1: v1,
    chart_r2: v2,
    chart_r3: v3,
  };
  return { chartIds, vectors };
}

async function runVerify(): Promise<void> {
  console.log('[verify-group-report] Running group report verification...');

  const profiles = listIntentProfiles();
  assertCheck(profiles.length > 0, 'At least one intent profile must exist');
  const profile = profiles[0];

  const { chartIds, vectors } = makeSampleVectors();
  const encoders: Record<string, string> = {
    chart_r1: 'v1',
    chart_r2: 'v1',
    chart_r3: 'v1',
  };

  const multi = computeMultiChartFromVectors(chartIds, profile, vectors, encoders);
  const fixedNow = new Date(0);

  const report1 = buildGroupReport(multi, { title: 'Test Group Report', now: fixedNow });
  const report2 = buildGroupReport(multi, { title: 'Test Group Report', now: fixedNow });
  const report3 = buildGroupReport(multi, { title: 'Test Group Report', now: fixedNow });

  const s1 = JSON.stringify(report1);
  const s2 = JSON.stringify(report2);
  const s3 = JSON.stringify(report3);
  assertCheck(s1 === s2 && s2 === s3, 'Group report must be deterministic across runs');

  assertCheck(
    report1.chart_ids.join(',') === [...report1.chart_ids].sort((a, b) => a.localeCompare(b, 'en')).join(','),
    'chart_ids must be sorted ASC'
  );

  for (const row of report1.matrix_preview) {
    const ids = row.top_matches.map((m) => m.chart_id);
    const uniqueIds = Array.from(new Set(ids));
    assertCheck(
      ids.length === uniqueIds.length,
      'top_matches must not contain duplicate chart_ids'
    );
  }

  console.log('[verify-group-report] All checks passed.');
  process.exit(0);
}

runVerify().catch((e) => {
  console.error('[verify-group-report]', e);
  process.exit(1);
});

export {};

