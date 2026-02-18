#!/usr/bin/env node
/**
 * Minimal test: load ML model and run studentVector once.
 * Run from repo root: node scripts/test-ml-load.js
 */
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));

async function main() {
  const feat = new Float32Array(64);
  feat.set([0.5, 0.6, 0.7, 0.7, 0.3, 0.6]);
  console.log('Loading ML and running studentVector...');
  const { studentVector } = require('../dist/vnext/vnext/ml/index.js');
  const r = await studentVector(feat);
  console.log('Result:', JSON.stringify({
    ml_used: r.ml_used,
    inference_ms: r.inference_ms,
    model_version: r.modelVersion,
    model_sha: r.model_sha,
    tf_backend: r.tf_backend,
    vector_len: r.vector?.length,
  }, null, 2));
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
