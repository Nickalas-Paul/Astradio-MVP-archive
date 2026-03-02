#!/usr/bin/env node
/**
 * Phase 5 — Verify non-platform chart creation route.
 * Static assertions: route exists, calls populateChartVector, sets is_non_platform=true.
 */

import * as fs from 'fs';
import * as path from 'path';

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, '../../..');
}

function assertCheck(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`[verify-non-platform-charts] FAIL: ${msg}`);
    process.exit(1);
  }
}

function runVerify(): void {
  console.log('[verify-non-platform-charts] Running non-platform chart verification...');

  const root = findRepoRoot();
  const routesPath = path.join(root, 'vnext', 'relational', 'routes.ts');
  const content = fs.readFileSync(routesPath, 'utf8');

  assertCheck(
    content.includes('/relational/charts'),
    'Route POST /api/relational/charts must exist'
  );

  assertCheck(
    content.includes('populateChartVector'),
    'Route must call populateChartVector (single vector write path)'
  );

  assertCheck(
    content.includes('createNonPlatformChart'),
    'Route must use createNonPlatformChart'
  );

  const pgStorePath = path.join(root, 'lib', 'pg-store.js');
  const pgContent = fs.readFileSync(pgStorePath, 'utf8');
  assertCheck(
    pgContent.includes('is_non_platform') && pgContent.includes('true'),
    'createNonPlatformChart must set is_non_platform=true'
  );

  assertCheck(
    !content.includes('generateArchitecture'),
    'Route must NOT call generateArchitecture directly'
  );

  assertCheck(
    content.includes('deleteChart'),
    'Route must support rollback (deleteChart on vectorization failure)'
  );

  console.log('[verify-non-platform-charts] All checks passed.');
  process.exit(0);
}

runVerify();

export {};
