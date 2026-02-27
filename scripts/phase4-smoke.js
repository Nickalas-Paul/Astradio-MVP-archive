#!/usr/bin/env node
/**
 * Phase 4 deterministic smoke: compat health, community feed, profile 404, compat matches fail-closed.
 * Usage: API_BASE_URL=http://localhost:4000 node scripts/phase4-smoke.js
 *        API_BASE_URL=https://your-engine.onrender.com node scripts/phase4-smoke.js
 */
const BASE = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
let pass = 0;
let fail = 0;

function result(ok, msg) {
  if (ok) {
    pass++;
    console.log('  PASS:', msg);
  } else {
    fail++;
    console.log('  FAIL:', msg);
  }
}

async function fetchOk(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  return { status: res.status, data, text };
}

async function main() {
  console.log('Phase 4 smoke:', BASE);
  console.log('---');

  // 1. GET /api/compat/health returns 200
  try {
    const r = await fetchOk(`${BASE}/api/compat/health`);
    if (r.status === 200) {
      result(true, 'GET /api/compat/health 200');
    } else {
      result(false, `GET /api/compat/health ${r.status}`);
    }
  } catch (e) {
    result(false, `GET /api/compat/health error: ${e.message}`);
  }

  // 2. GET /api/community/feed returns deterministic (200, posts array; empty or seeded)
  try {
    const r = await fetchOk(`${BASE}/api/community/feed`);
    if (r.status === 200 && Array.isArray(r.data?.posts)) {
      result(true, 'GET /api/community/feed 200 posts array');
    } else if (r.status === 200) {
      result(false, 'GET /api/community/feed 200 but no posts array');
    } else {
      result(false, `GET /api/community/feed ${r.status}`);
    }
  } catch (e) {
    result(false, `GET /api/community/feed error: ${e.message}`);
  }

  // 3. GET /api/profile/:handle returns 404 when handle not found
  try {
    const r = await fetchOk(`${BASE}/api/profile/__nonexistent_handle_phase4_smoke_${Date.now()}`);
    if (r.status === 404) {
      result(true, 'GET /api/profile/:handle 404 when not found');
    } else {
      result(false, `GET /api/profile/:handle expected 404 got ${r.status}`);
    }
  } catch (e) {
    result(false, `GET /api/profile/:handle error: ${e.message}`);
  }

  // 4. GET /api/compat/matches fail-closed when chart/vector missing (no auto-populate)
  try {
    const chartId = `chart_nonexistent_phase4_smoke_${Date.now()}`;
    const r = await fetchOk(`${BASE}/api/compat/matches?chartId=${encodeURIComponent(chartId)}&limit=5`);
    if (r.status === 404) {
      result(true, 'GET /api/compat/matches 404 when chart not found (fail-closed)');
    } else if (r.status === 500 && r.data?.error && (String(r.data.error).includes('Vector not found') || String(r.data.error).includes('not found'))) {
      result(true, 'GET /api/compat/matches 500 with explicit error when vector missing (fail-closed)');
    } else if (r.status === 200 && Array.isArray(r.data?.matches)) {
      result(false, 'GET /api/compat/matches 200 with matches for nonexistent chart (expected fail-closed)');
    } else {
      result(false, `GET /api/compat/matches ${r.status} expected 404/500 fail-closed, got: ${r.data?.error || r.text?.slice(0, 80) || 'ok'}`);
    }
  } catch (e) {
    result(false, `GET /api/compat/matches error: ${e.message}`);
  }

  console.log('---');
  console.log('Summary:', pass, 'passed,', fail, 'failed');
  process.exit(fail > 0 ? 1 : 0);
}

main();
