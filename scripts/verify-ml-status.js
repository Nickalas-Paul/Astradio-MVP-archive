#!/usr/bin/env node
/**
 * Quick ML status check: GET /api/ml-status and optionally one POST /api/compose.
 * Exit 0 if tf_backend is not noop, model_sha is not dev/local/unknown, ml_used true.
 * Usage: node scripts/verify-ml-status.js [BASE_URL]
 *        BASE_URL defaults to http://localhost:3000
 */

const BASE = process.env.BASE_URL || process.argv[2] || 'http://localhost:3000';

async function main() {
  console.log('ML status check:', BASE);
  const statusUrl = `${BASE}/api/ml-status`;
  let res = await fetch(statusUrl);
  if (!res.ok) {
    console.error('GET /api/ml-status failed:', res.status, await res.text());
    process.exit(1);
  }
  const status = await res.json();
  console.log('GET /api/ml-status:', JSON.stringify(status, null, 2));

  const noop = (status.tf_backend || '').toLowerCase() === 'noop';
  const devSha = /^(dev|local|unknown)$/i.test(String(status.model_sha || '').trim());
  const ok = status.ml_used && !noop && !devSha;

  if (!ok) {
    console.error('FAIL: ml_used=true, tf_backend!=noop, model_sha not dev/local/unknown required.');
    process.exit(1);
  }
  console.log('OK: ml_used=true, tf_backend=' + status.tf_backend + ', model_sha=' + status.model_sha);

  // Optional: one compose call to confirm telemetry in response
  const composeUrl = `${BASE}/api/compose`;
  res = await fetch(composeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'sky',
      skyParams: { latitude: 40.71, longitude: -74.01, datetime: '2024-01-15T12:00:00Z' },
    }),
  });
  if (!res.ok) {
    console.error('POST /api/compose failed:', res.status, await res.text());
    process.exit(1);
  }
  const compose = await res.json();
  const t = compose.telemetry || {};
  console.log('POST /api/compose telemetry:', { ml_used: t.ml_used, model_sha: t.model_sha, tf_backend: t.tf_backend });
  if (t.ml_used !== true || /^(dev|local|unknown)$/i.test(String(t.model_sha || '').trim()) || (t.tf_backend || '').toLowerCase() === 'noop') {
    console.error('FAIL: compose response telemetry must have ml_used=true, non-dev model_sha, tf_backend!=noop');
    process.exit(1);
  }
  console.log('OK: compose telemetry valid');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
