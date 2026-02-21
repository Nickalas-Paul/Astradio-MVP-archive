#!/usr/bin/env node
/**
 * Guardrail: fail if apps/web files use browser globals at top level without guarding.
 * Heuristic: file contains window. / new URLSearchParams(window / localStorage.
 * and does NOT contain "typeof window" (suggesting unguarded top-level use).
 * Run from repo root: node scripts/check-no-browser-globals-top-level.js
 * CI: npm run lint:web:safety
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = [
  path.join(ROOT, 'apps', 'web', 'src'),
  path.join(ROOT, 'apps', 'web', 'config'),
  path.join(ROOT, 'apps', 'web', 'app'),
];

const SUSPICIOUS = [
  (s) => s.includes('window.'),
  (s) => s.includes('new URLSearchParams(window'),
  (s) => s.includes('localStorage.'),
  (s) => s.includes('sessionStorage.'),
];
const SAFE = (s) => s.includes('typeof window');

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) yield full;
  }
}

const failures = [];
for (const dir of DIRS) {
  for (const file of walk(dir)) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, 'utf8');
    const hasSuspicious = SUSPICIOUS.some((fn) => fn(content));
    const hasSafe = SAFE(content);
    if (hasSuspicious && !hasSafe) {
      failures.push(rel);
    }
  }
}

if (failures.length) {
  console.error('lint:web:safety failed: files use browser globals without "typeof window" guard:');
  failures.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
console.log('lint:web:safety OK');
