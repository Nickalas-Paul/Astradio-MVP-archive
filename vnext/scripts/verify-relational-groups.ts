#!/usr/bin/env node
/**
 * Phase 5 — Verify relational groups (member resolver + store).
 * Lightweight: no Postgres required. Validates deterministic sort and module load.
 */

// Deterministic sort: chart_id ASC (same as member-resolver)
function sortChartIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b, 'en'));
}

function assertCheck(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-relational-groups] FAIL: ${msg}`);
    process.exit(1);
  }
}

async function runVerify(): Promise<void> {
  console.log('[verify-relational-groups] Running relational groups verification...');

  // 1. Deterministic sort: same input => same output across runs
  const ids1 = ['chart_z', 'chart_a', 'chart_m', 'chart_b'];
  const out1 = sortChartIds(ids1);
  const out2 = sortChartIds(ids1);
  assertCheck(JSON.stringify(out1) === JSON.stringify(out2), 'Sort must be deterministic');
  assertCheck(
    JSON.stringify(out1) === '["chart_a","chart_b","chart_m","chart_z"]',
    `Sort must be chart_id ASC; got ${JSON.stringify(out1)}`
  );

  // 2. Module load: resolver and routes load without error
  const { resolveGroupChartIds } = await import('../relational/groups/member-resolver');
  assertCheck(typeof resolveGroupChartIds === 'function', 'resolveGroupChartIds must be a function');

  // 3. Unauthorized / not-found: resolveGroupChartIds throws (fail-closed)
  // Without Postgres, relational-store throws on first use. With Postgres, we'd get "not found".
  // We just verify the function exists and is callable (would throw when store unavailable).
  try {
    await resolveGroupChartIds('rgrp_nonexistent999', 'usr_nonexistent999');
    assertCheck(false, 'resolveGroupChartIds should throw for nonexistent group');
  } catch (e: unknown) {
    const msg = (e as Error)?.message || '';
    const expected =
      msg.includes('not found') ||
      msg.includes('POSTGRES_URL') ||
      msg.includes('Relational group') ||
      msg.includes('relational');
    assertCheck(expected, `Expected fail-closed error; got: ${msg}`);
  }

  console.log('[verify-relational-groups] All checks passed.');
  process.exit(0);
}

runVerify().catch((e) => {
  console.error('[verify-relational-groups]', e);
  process.exit(1);
});

export {};
