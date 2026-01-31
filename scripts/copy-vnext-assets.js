#!/usr/bin/env node
/**
 * Copy vnext runtime assets into dist/ so they exist at the paths expected by compiled code.
 * Invoked as post-step after tsc (vnext:build).
 * Cross-platform (Node.js fs), deterministic.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const ASSETS = [
  // Runtime loads from dist/vnext/vnext/ (server vnextRoot)
  { src: 'vnext/explainer/mapping-tables-v1.json', dst: 'dist/vnext/vnext/explainer/mapping-tables-v1.json' },
];

for (const { src, dst } of ASSETS) {
  const srcPath = path.join(ROOT, src);
  const dstPath = path.join(ROOT, dst);
  if (!fs.existsSync(srcPath)) {
    console.error(`[copy-vnext-assets] Source missing: ${src}`);
    process.exit(1);
  }
  const dir = path.dirname(dstPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(srcPath, dstPath);
  console.log(`[copy-vnext-assets] Copied ${src} -> ${dst}`);
}
