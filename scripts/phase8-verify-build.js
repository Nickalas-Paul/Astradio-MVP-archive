#!/usr/bin/env node
/**
 * Phase 8 — Verify web build contains no legacy audio.
 * Run after building apps/web. Greps .next for forbidden references; fails if any found.
 *
 * Usage: node scripts/phase8-verify-build.js
 * Expects: apps/web/.next to exist (run "npm run build" in apps/web first, or use phase8:verify).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const NEXT_DIR = path.join(REPO_ROOT, 'apps/web/.next');

function fail(msg) {
  console.error('[phase8-verify-build] FAIL:', msg);
  process.exit(1);
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && (e.name.endsWith('.js') || e.name.endsWith('.json'))) yield full;
  }
}

if (!fs.existsSync(NEXT_DIR)) {
  fail('apps/web/.next not found. Run: cd apps/web && npm run build');
}

const forbidden = [
  { pattern: 'browser-performance-engine', name: 'legacy engine module' },
  { pattern: 'getGenrePack', name: 'legacy genre pack' },
  { pattern: 'getHousePack', name: 'legacy house pack' },
];

for (const { pattern, name } of forbidden) {
  for (const file of walk(NEXT_DIR)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(pattern)) {
      fail(`Build contains ${name}: ${path.relative(REPO_ROOT, file)}`);
    }
  }
}

console.log('[phase8-verify-build] No legacy audio references in .next');