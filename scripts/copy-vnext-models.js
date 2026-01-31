#!/usr/bin/env node
/**
 * Copy vnext ML model files into dist/models/ so they are present in the deploy artifact.
 * Invoked as post-step after vnext:build (same as copy-vnext-assets).
 * Cross-platform (Node.js fs), deterministic. Fails with clear error if any source is missing.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const MODELS = [
  { src: 'models/student-v2.2/model.json', dst: 'dist/models/student-v2.2/model.json' },
  { src: 'models/student-v2.2/group1-shard1of1.bin', dst: 'dist/models/student-v2.2/group1-shard1of1.bin' },
];

for (const { src, dst } of MODELS) {
  const srcPath = path.join(ROOT, src);
  const dstPath = path.join(ROOT, dst);
  if (!fs.existsSync(srcPath)) {
    console.error(`[copy-vnext-models] Source missing: ${src}`);
    console.error(`[copy-vnext-models] Absolute path: ${srcPath}`);
    process.exit(1);
  }
  const dir = path.dirname(dstPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(srcPath, dstPath);
  const size = fs.statSync(srcPath).size;
  console.log(`[copy-vnext-models] Copied ${src} -> ${dst} (${size} bytes)`);
}
