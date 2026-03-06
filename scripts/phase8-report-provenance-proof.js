#!/usr/bin/env node
/**
 * Phase 8 — Report provenance A/B proof.
 * Two materially different sandbox charts → different combinedHash and report payload.
 * Run with engine on API_BASE_URL (default http://localhost:4000).
 * Usage: node scripts/phase8-report-provenance-proof.js
 */

const BASE = (process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const birth = {
  date: '1990-01-15',
  time: '12:00',
  lat: 40.7128,
  lon: -74.006,
};

const overridesA = {
  planets: {
    sun: { lonDeg: 15 },
    moon: { lonDeg: 90 },
  },
};

const overridesB = {
  planets: {
    sun: { lonDeg: 195 },
    moon: { lonDeg: 270 },
  },
};

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log('[phase8-report-provenance-proof] BASE=', BASE);

  const snapA = await post('/api/sandbox/snapshot', { birth, overrides: overridesA });
  const combinedHashA = snapA.meta?.combinedHash;
  if (!combinedHashA) throw new Error('Snapshot A missing meta.combinedHash');

  const reportA = await post('/api/sandbox/report', { birth, overrides: overridesA, seed: combinedHashA });
  if (!reportA.personality || !reportA.guidance) throw new Error('Report A missing personality or guidance');

  const snapB = await post('/api/sandbox/snapshot', { birth, overrides: overridesB });
  const combinedHashB = snapB.meta?.combinedHash;
  if (!combinedHashB) throw new Error('Snapshot B missing meta.combinedHash');

  const reportB = await post('/api/sandbox/report', { birth, overrides: overridesB, seed: combinedHashB });
  if (!reportB.personality || !reportB.guidance) throw new Error('Report B missing personality or guidance');

  if (combinedHashA === combinedHashB) {
    console.error('FAIL: combinedHash should differ between chart A and B');
    process.exit(1);
  }
  console.log('OK: combinedHash differs (A vs B)');

  const personalitySame = JSON.stringify(reportA.personality) === JSON.stringify(reportB.personality);
  const guidanceSame = JSON.stringify(reportA.guidance) === JSON.stringify(reportB.guidance);
  const featuresSame = reportA.features?.length === reportB.features?.length &&
    reportA.features?.every((v, i) => v === reportB.features[i]);

  if (personalitySame && guidanceSame && featuresSame) {
    console.error('FAIL: report payload should differ between chart A and B');
    process.exit(1);
  }
  console.log('OK: report payload differs (personality/guidance/features track chart)');

  console.log('[phase8-report-provenance-proof] Done. Report is driven by sandbox chart.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
