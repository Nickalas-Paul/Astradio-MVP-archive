#!/usr/bin/env node
/**
 * Smoke test: daily overlay + sandbox compose, cache hits, and WAV download.
 * - Same overlay input twice → same export_id (cache hit).
 * - Same sandbox input twice → same export_id (cache hit).
 * - Different sandbox chart (birth/overrides) + same controls → different export_id.
 * - GET /api/exports/:id returns WAV bytes.
 * Usage: API_BASE_URL=http://localhost:4000 node scripts/smoke-lyria-export.js
 */
const crypto = require('crypto');
const base = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:4000';

function canonicalJson(obj) {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    return Object.keys(obj).sort().reduce((acc, k) => {
      acc[k] = canonicalJson(obj[k]);
      return acc;
    }, {});
  }
  return obj;
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

async function main() {
  const now = new Date();
  const currentDatetime = now.toISOString().slice(0, 19) + 'Z';

  console.log('Smoke test: Lyria/export pipeline + cache hits');
  console.log('Base URL:', base);

  // --- Daily overlay: same input twice → same export_id ---
  console.log('\n1) POST /api/compose (mode=overlay) — first call');
  const overlayBody = {
    mode: 'overlay',
    overlayParams: {
      natalLatitude: 40.7128,
      natalLongitude: -74.006,
      natalDatetime: '1990-06-15T14:30:00Z',
      currentLatitude: 40.7128,
      currentLongitude: -74.006,
      currentDatetime,
    },
  };
  const overlayRes1 = await fetch(`${base}/api/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overlayBody),
  });
  if (!overlayRes1.ok) {
    const t = await overlayRes1.text();
    throw new Error(`Overlay compose failed: ${overlayRes1.status} ${t}`);
  }
  const overlay1 = await overlayRes1.json();
  const dailyExportId1 = overlay1.export_id;
  console.log('  duration_s:', overlay1.duration_s, 'export_id:', dailyExportId1 ? dailyExportId1.slice(0, 16) + '...' : 'none');
  if (overlay1.duration_s !== 30) console.warn('  WARN: expected duration_s 30, got', overlay1.duration_s);

  console.log('\n2) POST /api/compose (mode=overlay) — second call (cache hit)');
  const overlayRes2 = await fetch(`${base}/api/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overlayBody),
  });
  if (!overlayRes2.ok) throw new Error(`Overlay compose 2nd failed: ${overlayRes2.status}`);
  const overlay2 = await overlayRes2.json();
  const dailyExportId2 = overlay2.export_id;
  if (dailyExportId1 !== dailyExportId2) {
    throw new Error(`Daily overlay cache miss: export_id changed (${dailyExportId1?.slice(0, 8)} → ${dailyExportId2?.slice(0, 8)})`);
  }
  console.log('  export_id unchanged (cache hit):', dailyExportId2?.slice(0, 16) + '...');

  // --- Sandbox: same input twice → same export_id ---
  const sandboxBody = {
    mode: 'sandbox',
    controls: {
      arc_shape: 0.5,
      density_level: 0.6,
      tempo_norm: 0.7,
      step_bias: 0.7,
      leap_cap: 5,
      rhythm_template_id: 3,
      syncopation_bias: 0.3,
      motif_rate: 0.6,
    },
    seed: 'smoke-sandbox-deterministic',
  };

  console.log('\n3) POST /api/compose (mode=sandbox) — first call');
  const sandboxRes1 = await fetch(`${base}/api/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sandboxBody),
  });
  if (!sandboxRes1.ok) {
    const t = await sandboxRes1.text();
    throw new Error(`Sandbox compose failed: ${sandboxRes1.status} ${t}`);
  }
  const sandbox1 = await sandboxRes1.json();
  const sandboxExportId1 = sandbox1.export_id;
  console.log('  duration_s:', sandbox1.duration_s, 'export_id:', sandboxExportId1 ? sandboxExportId1.slice(0, 16) + '...' : 'none');

  console.log('\n4) POST /api/compose (mode=sandbox) — second call (cache hit)');
  const sandboxRes2 = await fetch(`${base}/api/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sandboxBody),
  });
  if (!sandboxRes2.ok) throw new Error(`Sandbox compose 2nd failed: ${sandboxRes2.status}`);
  const sandbox2 = await sandboxRes2.json();
  const sandboxExportId2 = sandbox2.export_id;
  if (sandboxExportId1 !== sandboxExportId2) {
    throw new Error(`Sandbox cache miss: export_id changed (${sandboxExportId1?.slice(0, 8)} → ${sandboxExportId2?.slice(0, 8)})`);
  }
  console.log('  export_id unchanged (cache hit):', sandboxExportId2?.slice(0, 16) + '...');

  // --- Download daily WAV ---
  if (dailyExportId1) {
    console.log('\n5) GET /api/exports/' + dailyExportId1.slice(0, 16) + '...');
    const getDaily = await fetch(`${base}/api/exports/${dailyExportId1}`);
    if (!getDaily.ok) throw new Error(`Daily export download failed: ${getDaily.status}`);
    const buf = await getDaily.arrayBuffer();
    console.log('  OK:', buf.byteLength, 'bytes');
  }

  // --- Download sandbox WAV ---
  if (sandboxExportId1) {
    console.log('\n6) GET /api/exports/' + sandboxExportId1.slice(0, 16) + '...');
    const getSandbox = await fetch(`${base}/api/exports/${sandboxExportId1}`);
    if (!getSandbox.ok) throw new Error(`Sandbox export download failed: ${getSandbox.status}`);
    const buf = await getSandbox.arrayBuffer();
    console.log('  OK:', buf.byteLength, 'bytes');
  }

  // --- Different sandbox chart + same controls → different export_id ---
  const sandboxControls = {
    arc_shape: 0.5,
    density_level: 0.6,
    tempo_norm: 0.7,
    step_bias: 0.7,
    leap_cap: 5,
    rhythm_template_id: 3,
    syncopation_bias: 0.3,
    motif_rate: 0.6,
  };
  const controlsHash = sha256Hex(JSON.stringify(canonicalJson(sandboxControls)));

  const birth1 = { date: '2000-01-01', time: '12:00', lat: 40.7128, lon: -74.006 };
  const birth2 = { date: '1990-06-15', time: '14:30', lat: 35.6762, lon: -105.9396 };

  console.log('\n7) POST /api/sandbox/snapshot (birth A)');
  const snap1 = await fetch(`${base}/api/sandbox/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birth: birth1, overrides: { planets: {} } }),
  });
  if (!snap1.ok) throw new Error(`Sandbox snapshot A failed: ${snap1.status}`);
  const snap1Data = await snap1.json();
  const combinedHash1 = snap1Data?.meta?.combinedHash;
  if (!combinedHash1) throw new Error('Snapshot A missing meta.combinedHash');

  console.log('\n8) POST /api/compose (sandbox, seed=combinedHashA:controlsHash)');
  const diffBody1 = {
    mode: 'sandbox',
    controls: sandboxControls,
    seed: `${combinedHash1}:${controlsHash}`,
  };
  const diffRes1 = await fetch(`${base}/api/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(diffBody1),
  });
  if (!diffRes1.ok) throw new Error(`Sandbox compose A failed: ${diffRes1.status}`);
  const diff1 = await diffRes1.json();
  const exportIdA = diff1.export_id;
  console.log('  export_id A:', exportIdA ? exportIdA.slice(0, 16) + '...' : 'none');

  console.log('\n9) POST /api/sandbox/snapshot (birth B)');
  const snap2 = await fetch(`${base}/api/sandbox/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birth: birth2, overrides: { planets: {} } }),
  });
  if (!snap2.ok) throw new Error(`Sandbox snapshot B failed: ${snap2.status}`);
  const snap2Data = await snap2.json();
  const combinedHash2 = snap2Data?.meta?.combinedHash;
  if (!combinedHash2) throw new Error('Snapshot B missing meta.combinedHash');

  console.log('\n10) POST /api/compose (sandbox, seed=combinedHashB:controlsHash)');
  const diffBody2 = {
    mode: 'sandbox',
    controls: sandboxControls,
    seed: `${combinedHash2}:${controlsHash}`,
  };
  const diffRes2 = await fetch(`${base}/api/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(diffBody2),
  });
  if (!diffRes2.ok) throw new Error(`Sandbox compose B failed: ${diffRes2.status}`);
  const diff2 = await diffRes2.json();
  const exportIdB = diff2.export_id;
  console.log('  export_id B:', exportIdB ? exportIdB.slice(0, 16) + '...' : 'none');

  if (exportIdA === exportIdB) {
    throw new Error(`Different sandbox charts must yield different export_id (got same: ${exportIdA?.slice(0, 8)}...)`);
  }
  console.log('  OK: different export_id for different chart (A !== B).');

  console.log('\nSmoke test passed (cache hits for daily + sandbox, different chart → different export_id, downloads OK).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
