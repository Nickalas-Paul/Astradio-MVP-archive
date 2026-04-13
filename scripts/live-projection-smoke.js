/**
 * Live smoke: Render engine + Vercel BFF (protection bypass) + optional DB ping.
 * Usage:
 *   set RENDER_BASE=https://astradio-mvp-archive.onrender.com
 *   set VERCEL_BASE=https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app
 *   set VERCEL_BYPASS_TOKEN=...
 *   set DATABASE_URL=postgresql://...   (optional)
 *   node scripts/live-projection-smoke.js
 */
/* eslint-disable no-console */

const RENDER = process.env.RENDER_BASE || 'https://astradio-mvp-archive.onrender.com';
const VERCEL = process.env.VERCEL_BASE || 'https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app';
const BYPASS = process.env.VERCEL_BYPASS_TOKEN || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  const text = await r.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text.slice(0, 500) };
  }
  return { status: r.status, json, ok: r.ok };
}

function analyzeExplainerPayload(data, label) {
  const sections = data?.explainer?.sections || data?.sections;
  assert(Array.isArray(sections) && sections.length > 0, `${label}: missing sections array`);
  const joined = sections.map((s) => `${s.title || ''}\n${s.text || ''}`).join('\n');
  const lastMeta = sections[sections.length - 1]?.meta;
  const pv = lastMeta?.projection_validation;
  return { sections, joined, pv, sectionIds: sections.map((s) => s.id) };
}

async function main() {
  const results = { A: {}, B: {}, C: {}, D: {}, E: {}, F: {}, G: {}, db: {} };

  // --- A: service smoke ---
  const health = await fetchJson(`${RENDER}/api/compat/health`);
  results.A.render_health = { status: health.status, ok: health.ok && health.json?.status === 'healthy' };

  const vercelProbe = await fetchJson(`${VERCEL}/api/profile/chart?chartId=chart_profile_default`, {
    headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {},
  });
  results.A.vercel_profile_chart = { status: vercelProbe.status, ok: vercelProbe.ok };

  // --- B: projection matrix (engine direct) ---
  const p1 = await fetchJson(`${RENDER}/api/profile/chart?chartId=chart_profile_default`);
  assert(p1.ok, `Profile chart: HTTP ${p1.status}`);
  const a1 = analyzeExplainerPayload(p1.json, 'profile');
  results.B.profile_single_A = {
    ok: true,
    sectionCount: a1.sections.length,
    has_validation_meta: !!a1.pv,
    ids_sample: a1.sectionIds.slice(0, 6),
  };

  const p2 = await fetchJson(`${RENDER}/api/profile/chart?chartId=chart_profile_default`);
  const a2 = analyzeExplainerPayload(p2.json, 'profile2');
  results.B.profile_determinism = {
    ok: JSON.stringify(a1.sectionIds) === JSON.stringify(a2.sectionIds),
    same_text: a1.joined === a2.joined,
  };

  const activeBody = {
    chartId: 'chart_profile_default',
    calendarDate: '2026-04-10',
    localTime: '12:00',
    location: {
      source: 'browser_geo',
      label: 'NYC smoke',
      lat: 40.7128,
      lon: -74.006,
      timezone: 'America/New_York',
      resolvedAt: new Date().toISOString(),
    },
  };
  const act = await fetchJson(`${RENDER}/api/profile/active-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(activeBody),
  });
  const activeExpl = act.json?.explanation;
  const activeSections = activeExpl?.sections || act.json?.sections;
  if (act.ok && Array.isArray(activeSections) && activeSections.length > 0) {
    const joined = activeSections.map((s) => `${s.title || ''}\n${s.text || ''}`).join('\n');
    results.B.profile_active_Ct = {
      ok: true,
      sectionCount: activeSections.length,
      has_astrological_title: /astrological/i.test(joined),
    };
  } else {
    results.B.profile_active_Ct = { ok: false, status: act.status, error: act.json?.error || act.json?.code };
  }

  const sbGet = await fetchJson(`${RENDER}/api/sandbox/compositions`);
  results.B.sandbox_list = { status: sbGet.status, ok: sbGet.ok || sbGet.status === 404 || sbGet.status === 401 };

  const camp = await fetchJson(`${RENDER}/api/campaigns`);
  results.B.campaigns_route = { status: camp.status, ok: camp.ok || camp.status === 401 || camp.status === 404 };

  // --- C: tone / campaign heuristics on engine profile (campaign surface not on this route; check no raw TENSION in typical profile) ---
  const badIds = /\bTENSION_BAND_|\bMOTION_LABEL_/i.test(a1.joined);
  results.C.engine_profile_copy = { raw_claim_ids_in_text: badIds, pass: !badIds };

  // --- D: perceptual listen hints (humanized path: motion/pressure/space, not internal "envelope") ---
  const hasPerceptual =
    /How this sounds|listen metaphor|The pulse runs|Listening pressure|Entries stack|Energy lifts|Energy thins|Voices overlap|Figures trade|Layers hold|Voicing stays|motion feels|texture feels/i.test(
      a1.joined
    );
  results.D.perceptual_listen_hints = { present: hasPerceptual };

  // --- E: Vercel parity (sections non-empty) ---
  if (vercelProbe.ok) {
    const v = analyzeExplainerPayload(vercelProbe.json, 'vercel');
    const v2 = await fetchJson(`${VERCEL}/api/profile/chart?chartId=chart_profile_default`, {
      headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {},
    });
    const v2a = v2.ok ? analyzeExplainerPayload(v2.json, 'vercel2') : null;
    results.E.vercel_sections = {
      count: v.sections.length,
      ok: v.sections.length > 0,
      determinism_ok: v2a ? v.joined === v2a.joined : false,
    };
  } else {
    results.E.vercel_sections = { ok: false, status: vercelProbe.status };
  }

  // --- F: DB optional ---
  if (DATABASE_URL) {
    try {
      const { Client } = require('pg');
      const c = new Client({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : undefined,
      });
      await c.connect();
      const q = await c.query('SELECT 1 AS ok');
      await c.end();
      results.db = { ok: true, row: q.rows[0] };
    } catch (e) {
      results.db = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    results.db = { skipped: true };
  }

  // --- G: summary pass/fail ---
  const fails = [];
  if (!results.A.render_health.ok) fails.push('render_health');
  if (!results.A.vercel_profile_chart.ok) fails.push('vercel_profile_chart');
  if (!results.B.profile_determinism.ok || !results.B.profile_determinism.same_text) fails.push('determinism');
  if (!results.B.profile_active_Ct.ok) fails.push('profile_active_Ct');
  if (!results.C.engine_profile_copy.pass) fails.push('raw_ids_in_profile');
  if (results.E.vercel_sections && results.E.vercel_sections.determinism_ok === false) fails.push('vercel_determinism');
  if (results.db.ok === false) fails.push('database');
  results.G = { pass: fails.length === 0, fails };

  console.log(JSON.stringify(results, null, 2));
  if (fails.length) process.exit(1);
}

main().catch((e) => {
  console.error('[live-projection-smoke] FATAL', e.message);
  process.exit(1);
});
