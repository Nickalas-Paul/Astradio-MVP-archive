#!/usr/bin/env node
/**
 * Phase 5 — Smoke runner. Runs full verification chain in order, fail-fast.
 * No Postgres, no network. Deterministic harness only.
 */

import * as path from 'path';
import { execSync } from 'child_process';

const SCRIPTS = [
  'phase5-guard.js',
  'verify-intent-profiles.js',
  'verify-intent-scoring.js',
  'verify-phantoms.js',
  'verify-constellations.js',
  'verify-owner-identity.js',
  'verify-relational-groups.js',
  'verify-non-platform-charts.js',
  'verify-multi-chart.js',
  'verify-group-compose.js',
  'verify-group-report.js',
  'verify-relational-routes.js',
];

function main(): void {
  const dir = __dirname;
  for (const script of SCRIPTS) {
    const scriptPath = path.join(dir, script);
    try {
      execSync(`node "${scriptPath}"`, {
        stdio: 'inherit',
        encoding: 'utf8',
      });
    } catch (e) {
      process.stderr.write(
        `[phase5-smoke] FAIL: ${script} exited non-zero\n`
      );
      process.exit(1);
    }
  }
  process.stdout.write('PHASE5 SMOKE PASS\n');
  process.exit(0);
}

main();
