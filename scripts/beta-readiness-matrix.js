#!/usr/bin/env node
/**
 * Beta Readiness Performance Matrix
 *
 * Characterizes cold vs warm performance against Render; quantifies WAV/MIDI export impact.
 *
 * Usage:
 *   node scripts/beta-readiness-matrix.js
 *   BASE_URL=https://astradio-mvp-archive.onrender.com node scripts/beta-readiness-matrix.js
 *
 * Steps:
 * 1) Confirm /health and /readyz return 200
 * 2) Run 5 timed compose requests (same body), report avg/p95
 * 3) Verify WAV-disabled path: response includes plan, frontend Tone fallback can play
 * 4) Run with MIDI enabled (includeMidi: 1), measure elapsed_ms, response size
 * 5) Summarize findings and beta blockers
 */

const BASE_URL = process.env.BASE_URL || 'https://astradio-mvp-archive.onrender.com';
const COMPOSE_URL = `${BASE_URL}/api/compose`;
const HEALTH_URL = `${BASE_URL}/health`;
const READYZ_URL = `${BASE_URL}/readyz`;
const TIMEOUT_MS = 90_000;

const COMPOSE_BODY = {
  mode: 'sky',
  skyParams: {
    latitude: 40.7128,
    longitude: -74.006,
    datetime: '2025-02-06T12:00:00Z',
  },
};

const COMPOSE_BODY_MIDI = {
  ...COMPOSE_BODY,
  includeMidi: 1,
};

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function p95(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(arr.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), options.timeout || TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return r;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function checkHealth() {
  console.log('\n=== Step 1: Health Endpoints ===');
  const results = { health: null, readyz: null };

  try {
    const healthRes = await fetchWithTimeout(HEALTH_URL);
    const healthData = await healthRes.json().catch(() => ({}));
    results.health = {
      status: healthRes.status,
      ok: healthRes.ok,
      data: healthData,
    };
    console.log(
      results.health.ok
        ? `  ✅ /health: ${healthRes.status} (${healthData.status || 'ok'})`
        : `  ❌ /health: ${healthRes.status} ${JSON.stringify(healthData)}`
    );
  } catch (e) {
    results.health = { status: 0, ok: false, error: e.message };
    console.log(`  ❌ /health: ${e.message}`);
  }

  try {
    const readyzRes = await fetchWithTimeout(READYZ_URL);
    const readyzData = await readyzRes.json().catch(() => ({}));
    results.readyz = {
      status: readyzRes.status,
      ok: readyzRes.ok,
      data: readyzData,
    };
    console.log(
      results.readyz.ok
        ? `  ✅ /readyz: ${readyzRes.status}`
        : `  ⚠️ /readyz: ${readyzRes.status} (may return 503 when bounded checks fail)`
    );
  } catch (e) {
    results.readyz = { status: 0, ok: false, error: e.message };
    console.log(`  ❌ /readyz: ${e.message}`);
  }

  const healthOk = results.health?.status === 200;
  if (!healthOk) {
    throw new Error('Health check failed - /health must return 200');
  }
  return results;
}

async function timedCompose(body, label) {
  const start = Date.now();
  let responseSize = 0;
  try {
    const r = await fetchWithTimeout(COMPOSE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    responseSize = Buffer.byteLength(text, 'utf8');
    const json = JSON.parse(text);
    const elapsed = Date.now() - start;
    return { ok: r.ok, status: r.status, json, elapsed_ms: elapsed, responseSize };
  } catch (e) {
    const elapsed = Date.now() - start;
    return {
      ok: false,
      status: 0,
      json: {},
      elapsed_ms: elapsed,
      responseSize,
      error: e.message,
    };
  }
}

async function main() {
  console.log('Beta Readiness Performance Matrix');
  console.log('Target:', BASE_URL);
  console.log('Timeout:', TIMEOUT_MS, 'ms');

  const findings = { blockers: [], warnings: [] };

  // Step 1
  let healthResults;
  try {
    healthResults = await checkHealth();
  } catch (e) {
    console.error('\n', e.message);
    findings.blockers.push(e.message);
    printSummary(findings, null, null, null);
    process.exit(1);
  }

  // Step 2: 5 timed compose requests (same body)
  console.log('\n=== Step 2: 5x Compose (baseline, no MIDI) ===');
  const times = [];
  let lastRes = null;
  for (let i = 0; i < 5; i++) {
    process.stdout.write(`  Request ${i + 1}/5... `);
    const res = await timedCompose(COMPOSE_BODY, `compose-${i + 1}`);
    lastRes = res;
    if (res.ok) {
      times.push(res.elapsed_ms);
      console.log(`${res.elapsed_ms} ms (cold=${i === 0 ? 'likely' : 'no'})`);
    } else {
      console.log(`FAIL ${res.status} ${res.error || res.json?.error || ''}`);
      findings.blockers.push(`Compose request ${i + 1} failed: ${res.status}`);
    }
  }

  const coldMs = times[0];
  const warmTimes = times.slice(1);
  const warmAvg = avg(warmTimes);
  const warmP95 = p95(warmTimes);
  const allAvg = avg(times);
  const allP95 = p95(times);

  console.log(`  Cold (req 1): ${coldMs ?? 'N/A'} ms`);
  console.log(`  Warm avg (req 2-5): ${warmAvg.toFixed(0)} ms`);
  console.log(`  Warm p95 (req 2-5): ${warmP95.toFixed(0)} ms`);
  console.log(`  All avg: ${allAvg.toFixed(0)} ms`);
  console.log(`  All p95: ${allP95.toFixed(0)} ms`);

  // Step 3: WAV-disabled path verification
  console.log('\n=== Step 3: WAV-Disabled Path (plan + Tone fallback) ===');
  const wavCheckRes = lastRes ?? (await timedCompose(COMPOSE_BODY, 'wav-check'));
  if (wavCheckRes.ok && wavCheckRes.json) {
    const j = wavCheckRes.json;
    const hasPlan = !!j.plan && Array.isArray(j.plan?.events);
    const audioExport = j.audio_export_available === true;
    const hasControls = !!j.controls;
    const hasExplanation = !!j.explanation;

    console.log(`  audio_export_available: ${audioExport}`);
    console.log(`  plan present: ${hasPlan} (events: ${j.plan?.events?.length ?? 0})`);
    console.log(`  controls: ${hasControls}`);
    console.log(`  explanation: ${!!hasExplanation}`);

    if (!audioExport && !hasPlan) {
      findings.blockers.push(
        'WAV disabled but plan not included - frontend Tone fallback cannot play'
      );
    } else if (!audioExport && hasPlan) {
      console.log('  ✅ Plan included when WAV disabled - Tone fallback can play');
    } else if (audioExport) {
      console.log('  ✅ WAV export enabled - response includes base64 audio');
    }
  } else {
    findings.warnings.push('Could not verify WAV-disabled path (compose failed)');
  }

  // Step 4: MIDI export
  console.log('\n=== Step 4: MIDI Export (includeMidi: 1) ===');
  const midiRes = await timedCompose(COMPOSE_BODY_MIDI, 'midi');
  if (midiRes.ok && midiRes.json) {
    const j = midiRes.json;
    const hasMidi = !!j.artifacts?.midi;
    const midiBytes = j.artifacts?.midi?.bytes ?? 0;

    console.log(`  elapsed_ms: ${midiRes.elapsed_ms}`);
    console.log(`  response size: ${(midiRes.responseSize / 1024).toFixed(1)} KB`);
    console.log(`  MIDI in artifacts: ${hasMidi}`);
    if (hasMidi) {
      console.log(`  MIDI bytes: ${midiBytes}`);
    }

    if (!hasMidi) {
      findings.warnings.push(
        'MIDI requested but not in response (ENABLE_MIDI_EXPORT may be unset on Render)'
      );
    }
  } else {
    findings.warnings.push(`MIDI compose failed: ${midiRes.status} ${midiRes.error || ''}`);
  }

  // Step 5: Summary
  printSummary(findings, { coldMs, warmAvg, warmP95, allAvg, allP95 }, lastRes, midiRes);
  process.exit(findings.blockers.length > 0 ? 1 : 0);
}

function printSummary(findings, perf, baselineRes, midiRes) {
  console.log('\n=== Summary ===');
  console.log('Cold vs warm:');
  if (perf) {
    console.log(`  Cold (1st req): ${perf.coldMs ?? 'N/A'} ms`);
    console.log(`  Warm avg: ${perf.warmAvg.toFixed(0)} ms`);
    console.log(`  Warm p95: ${perf.warmP95.toFixed(0)} ms`);
  }
  console.log('WAV export impact:');
  console.log('  (Render staging typically has ENABLE_WAV_EXPORT off; response includes plan for Tone fallback)');
  console.log('MIDI export impact:');
  if (midiRes?.ok) {
    const delta = midiRes.elapsed_ms - (baselineRes?.elapsed_ms ?? 0);
    console.log(`  +${delta} ms vs baseline, +${((midiRes.responseSize - (baselineRes?.responseSize ?? 0)) / 1024).toFixed(1)} KB`);
  }
  if (findings.blockers.length) {
    console.log('\nBeta blockers:');
    findings.blockers.forEach((b) => console.log(`  ❌ ${b}`));
  }
  if (findings.warnings.length) {
    console.log('\nWarnings:');
    findings.warnings.forEach((w) => console.log(`  ⚠️ ${w}`));
  }
  if (findings.blockers.length === 0 && findings.warnings.length === 0) {
    console.log('\n✅ No blockers or warnings.');
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
