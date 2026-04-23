#!/usr/bin/env node
/**
 * Post-seed smoke: chart-snapshot, compatibility score, relational feed (after db:qa-compat-seed on target DB).
 *
 *   API_BASE_URL=https://engine.example.com BYPASS_TOKEN=... node scripts/qa-compat-smoke.js
 *   (BYPASS optional for Vercel protection)
 */
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const BASE = (process.env.API_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const BYPASS = (process.env.BYPASS_TOKEN || process.env.VERCEL_BYPASS_TOKEN || process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '').trim();
const TIMEOUT_MS = Math.max(15000, parseInt(process.env.VERIFY_TIMEOUT_MS || '60000', 10) || 60000);

function headers(json = true) {
  const h = { ...bypassHeaders() };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function bypassHeaders() {
  return BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {};
}

async function fetchJson(url, init = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ac.signal, headers: { ...headers(!!init.body), ...init.headers } });
    const text = await r.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { _raw: text.slice(0, 500) };
    }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const results = [];
  // 1) chart-snapshot
  const snapUrl = `${BASE}/api/chart-snapshot?${new URLSearchParams({
    date: '1990-01-01',
    time: '12:00',
    lat: '0',
    lon: '0',
  })}`;
  const s1 = await fetchJson(snapUrl, { method: 'GET' });
  results.push({ step: 'GET /api/chart-snapshot', pass: s1.ok && s1.status === 200, detail: s1 });

  // 2) compatibility score (two QA charts)
  const s2 = await fetchJson(`${BASE}/api/compatibility/score`, {
    method: 'POST',
    body: JSON.stringify({
      chartIds: ['qa_compat_chart_01', 'qa_compat_chart_02'],
    }),
  });
  const scoreOk =
    s2.ok &&
    s2.status === 200 &&
    s2.body &&
    typeof s2.body.compatibility_field_hash === 'string' &&
    s2.body.scoring;
  results.push({ step: 'POST /api/compatibility/score (A+B)', pass: !!scoreOk, detail: s2 });

  // 3) compatibility with transit (A + B + C(t))
  const s3 = await fetchJson(`${BASE}/api/compatibility/score`, {
    method: 'POST',
    body: JSON.stringify({
      chartIds: ['qa_compat_chart_01', 'qa_compat_chart_02'],
      transit: {
        date: '2026-04-15',
        time: '12:00',
        lat: 40.7128,
        lon: -74.006,
        timezone: 'America/New_York',
      },
    }),
  });
  const scoreTransitOk = s3.ok && s3.status === 200 && s3.body && s3.body.scoring;
  results.push({ step: 'POST /api/compatibility/score (A+B+transit)', pass: !!scoreTransitOk, detail: s3 });

  // 4) relational feed — qa_compat_user_11
  const transit1 = {
    date: '2026-04-15',
    time: '12:00',
    lat: 29.76,
    lon: -95.37,
    timezone: 'America/Chicago',
  };
  const s4 = await fetchJson(`${BASE}/api/community/relational-feed`, {
    method: 'POST',
    body: JSON.stringify({
      userId: 'qa_compat_user_11',
      transit: transit1,
    }),
  });
  const feed1Ok =
    s4.ok &&
    s4.status === 200 &&
    s4.body &&
    s4.body.version === 'community_relational_feed_v1' &&
    Array.isArray(s4.body.items);
  results.push({ step: 'POST /api/community/relational-feed (user 11, transit 1)', pass: !!feed1Ok, detail: s4 });

  // 5) same user, different transit (reorder potential)
  const s5 = await fetchJson(`${BASE}/api/community/relational-feed`, {
    method: 'POST',
    body: JSON.stringify({
      userId: 'qa_compat_user_11',
      transit: {
        date: '2026-04-20',
        time: '18:00',
        lat: 51.5074,
        lon: -0.1278,
        timezone: 'Europe/London',
      },
    }),
  });
  const feed2Ok =
    s5.ok &&
    s5.status === 200 &&
    s5.body &&
    s5.body.version === 'community_relational_feed_v1' &&
    Array.isArray(s5.body.items);
  results.push({ step: 'POST /api/community/relational-feed (user 11, transit 2)', pass: !!feed2Ok, detail: s5 });

  const allPass = results.every((r) => r.pass);
  console.log(JSON.stringify({ base: BASE, allPass, results }, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
