#!/usr/bin/env node
/**
 * Phase 8 — Lyria-only audio guardrail.
 *
 * Ensures:
 * - Home page (apps/web/app/page.tsx) uses Lyria-only in production: isLyriaOnly and tryOrder = ['server'] when production.
 * - Browser performance engine (browser-performance-engine.ts) throws in production to prevent /audio/samples requests.
 *
 * Run in CI to prevent regression. No vnext build required.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

function readFile(p) {
  const full = path.join(REPO_ROOT, p);
  try {
    return fs.readFileSync(full, 'utf8');
  } catch (e) {
    console.error(`[phase8-audio-guard] Cannot read ${p}:`, e.message);
    return null;
  }
}

function fail(msg) {
  console.error('[phase8-audio-guard] FAIL:', msg);
  process.exit(1);
}

const pageTsx = readFile('apps/web/app/page.tsx');
if (!pageTsx) fail('apps/web/app/page.tsx not found');

if (!pageTsx.includes('isLyriaOnly')) {
  fail('page.tsx must define isLyriaOnly for Phase 8 Lyria-only production gate');
}
if (!pageTsx.includes("['server']")) {
  fail("page.tsx must set tryOrder to ['server'] when isLyriaOnly so production never tries browser/legacy");
}
if (!pageTsx.includes('tryOrder')) {
  fail("page.tsx must define tryOrder for audio engine selection");
}

const engineTs = readFile('apps/web/src/core/audio/browser-performance-engine.ts');
if (!engineTs) fail('browser-performance-engine.ts not found');

if (!engineTs.includes('Phase 8') || !engineTs.includes('Legacy sample-based engine is disabled in production')) {
  fail('browser-performance-engine.ts must throw in production (Phase 8 Lyria-only guard)');
}
if (!engineTs.includes('process.env?.NODE_ENV === \'production\'') && !engineTs.includes('process.env.NODE_ENV === \'production\'')) {
  fail('browser-performance-engine.ts must check NODE_ENV === \'production\' before creating engine');
}

console.log('[phase8-audio-guard] Lyria-only guards present in page.tsx and browser-performance-engine.ts');
