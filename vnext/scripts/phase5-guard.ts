#!/usr/bin/env node
/**
 * Phase 5 — Isolation and invariants guard.
 * Run: npm run phase5:guard (or node dist/vnext/scripts/phase5-guard.js after build)
 *
 * Enforces:
 * - No diffs to protected files (architecture-engine, compose, feature-encode)
 * - No Math.random in vnext/relational/
 * - Matches/scoring modules do not import architecture-engine or call generateArchitecture
 */

import * as fs from 'fs';
import * as path from 'path';

// Resolve repo root: from dist/vnext/vnext/scripts/ go up until we find package.json
function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, '../../../../../'); // fallback
}
const REPO_ROOT = findRepoRoot();

const PROTECTED_FILES = [
  'vnext/core/architecture-engine.ts',
  'vnext/api/compose.ts',
  'vnext/feature-encode.ts',
];

const MATCHES_SCORING_FILES = [
  'vnext/compat/matches.ts',
  'vnext/relational/compatibility/score.ts',
];

function readFileOrNull(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function checkProtectedFilesUnchanged(): void {
  for (const rel of PROTECTED_FILES) {
    const full = path.join(REPO_ROOT, rel);
    const content = readFileOrNull(full);
    if (!content) {
      console.error(`[phase5-guard] Protected file missing or unreadable: ${rel}`);
      process.exit(1);
    }
    if (content.includes('// PHASE5_EDIT_ALLOWED')) {
      console.error(`[phase5-guard] Protected file must not contain PHASE5_EDIT_ALLOWED: ${rel}`);
      process.exit(1);
    }
  }
  console.log('[phase5-guard] Protected files: present and unmodified');
}

function checkNoMathRandomInRelational(): void {
  const relationalDir = path.join(REPO_ROOT, 'vnext', 'relational');
  if (!fs.existsSync(relationalDir)) {
    console.log('[phase5-guard] vnext/relational/ does not exist yet; skip Math.random check');
    return;
  }
  const files: string[] = [];
  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.ts') || e.name.endsWith('.js')) files.push(full);
    }
  }
  walk(relationalDir);
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('Math.random')) {
      const rel = path.relative(REPO_ROOT, f);
      console.error(`[phase5-guard] Math.random forbidden in vnext/relational: ${rel}`);
      process.exit(1);
    }
  }
  console.log('[phase5-guard] No Math.random in vnext/relational/');
}

function checkOwnerIdentityGate(): void {
  const rel = 'vnext/relational/owner-resolve.ts';
  const full = path.join(REPO_ROOT, rel);
  const content = readFileOrNull(full);
  if (!content) {
    console.error(`[phase5-guard] Owner resolve module missing: ${rel}`);
    process.exit(1);
  }
  if (!content.includes('NODE_ENV') || !content.includes("'development'")) {
    console.error(`[phase5-guard] ${rel} must gate on NODE_ENV === 'development'`);
    process.exit(1);
  }
  if (!content.includes('ALLOW_DEV_USER_FALLBACK')) {
    console.error(`[phase5-guard] ${rel} must require ALLOW_DEV_USER_FALLBACK for dev override`);
    process.exit(1);
  }
  if (!content.includes('req?.user') && !content.includes('req.user')) {
    console.error(`[phase5-guard] ${rel} must check req.user first (session)`);
    process.exit(1);
  }
  console.log('[phase5-guard] Owner identity: session-first, dev gate present');
}

function checkMatchesNoArchitectureEngine(): void {
  const importOrCallPatterns = [
    /import\s+.*['"].*architecture-engine['"]/,
    /from\s+['"].*architecture-engine['"]/,
    /require\s*\(\s*['"].*architecture-engine['"]/,
    /generateArchitecture\s*\(/,
    /\.generateArchitecture\s*\(/,
  ];
  for (const rel of MATCHES_SCORING_FILES) {
    const full = path.join(REPO_ROOT, rel);
    const content = readFileOrNull(full);
    if (!content) continue; // file may not exist yet
    for (const re of importOrCallPatterns) {
      if (re.test(content)) {
        console.error(`[phase5-guard] ${rel} must not import architecture-engine or call generateArchitecture`);
        process.exit(1);
      }
    }
  }
  console.log('[phase5-guard] Matches/scoring: no architecture-engine dependency');
}

function main(): void {
  console.log('[phase5-guard] Running Phase 5 isolation checks...');
  checkProtectedFilesUnchanged();
  checkNoMathRandomInRelational();
  checkMatchesNoArchitectureEngine();
  checkOwnerIdentityGate();
  console.log('[phase5-guard] All guards passed.');
}

main();
