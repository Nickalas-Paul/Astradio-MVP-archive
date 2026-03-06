#!/usr/bin/env node
/**
 * Phase 8 — Lyria-only audio. Hard fail if legacy paths exist in web runtime.
 *
 * Ensures:
 * - Single playback path: lyria-playback.ts exists and is used (page uses playLyriaAudio).
 * - No Tone.js: no import/require of 'tone' in apps/web/app or apps/web/src.
 * - No sample paths: no string literal '/audio/samples/' in runtime code.
 * - No legacy engine: no import of browser-performance-engine (the module itself is a dead stub that throws).
 *
 * Scans: apps/web/app, apps/web/src (excludes node_modules). Fails CI on first violation.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const WEB_APP = path.join(REPO_ROOT, 'apps/web/app');
const WEB_SRC = path.join(REPO_ROOT, 'apps/web/src');

function fail(msg) {
  console.error('[phase8-audio-guard] FAIL:', msg);
  process.exit(1);
}

function* walk(dir, ext) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') {
      yield* walk(full, ext);
    } else if (e.isFile() && (!ext || ext.some((x) => e.name.endsWith(x)))) {
      yield full;
    }
  }
}

const exts = ['.ts', '.tsx', '.js', '.jsx'];
const files = [...walk(WEB_APP, exts), ...walk(WEB_SRC, exts)];

// 1) lyria-playback must exist and page must use it
const lyriaPath = path.join(REPO_ROOT, 'apps/web/src/core/audio/lyria-playback.ts');
if (!fs.existsSync(lyriaPath)) fail('lyria-playback.ts not found (required single playback path).');
const pagePath = path.join(REPO_ROOT, 'apps/web/app/page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf8');
if (!pageContent.includes('playLyriaAudio') || !pageContent.includes('lyria-playback')) {
  fail('page.tsx must use playLyriaAudio from lyria-playback (no legacy engine selection).');
}

// 2) No Tone.js
const tonePatterns = [
  /from\s+['"]tone['"]/,
  /import\s*\(\s*['"]tone['"]\s*\)/,
  /require\s*\(\s*['"]tone['"]\s*\)/,
];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const re of tonePatterns) {
    if (re.test(content)) {
      fail(`Tone.js usage in ${path.relative(REPO_ROOT, file)}. Lyria-only.`);
    }
  }
}

// 3) No /audio/samples/ in runtime (except lyria-playback.ts where it is the forbidden constant)
for (const file of files) {
  if (file.endsWith('lyria-playback.ts')) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('/audio/samples/')) {
    fail(`Forbidden path /audio/samples/ in ${path.relative(REPO_ROOT, file)}. Lyria-only.`);
  }
}

// 4) No import of browser-performance-engine (dead module must not be imported)
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('browser-performance-engine')) {
    fail(`Import of legacy browser-performance-engine in ${path.relative(REPO_ROOT, file)}. Lyria-only.`);
  }
}

// 5) Dead module must throw on load
const deadPath = path.join(REPO_ROOT, 'apps/web/src/core/audio/browser-performance-engine.ts');
const deadContent = fs.readFileSync(deadPath, 'utf8');
if (!deadContent.includes('Legacy audio engine is removed') || !deadContent.includes('Lyria-only')) {
  fail('browser-performance-engine.ts must be a dead module that throws (Lyria-only).');
}

console.log('[phase8-audio-guard] Lyria-only: no Tone, no samples, no legacy engine.');
console.log('[phase8-audio-guard] Single playback path: lyria-playback.ts');
