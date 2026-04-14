/**
 * Live smoke for music translation refinement (approved checklist A–H subset over HTTP).
 *
 * Usage (PowerShell):
 *   $env:RENDER_BASE='https://astradio-mvp-archive.onrender.com'
 *   $env:VERCEL_BASE='https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app'
 *   $env:VERCEL_BYPASS_TOKEN='...'
 *   node scripts/music-translation-live-smoke.mjs
 */
/* eslint-disable no-console */

const RENDER = (process.env.RENDER_BASE || 'https://astradio-mvp-archive.onrender.com').replace(/\/$/, '');
const VERCEL = (process.env.VERCEL_BASE || 'https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app').replace(
  /\/$/,
  ''
);
const BYPASS = (process.env.VERCEL_BYPASS_TOKEN || '').trim();
const CHART_URL_PATH = '/api/profile/chart?chartId=chart_profile_default';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function fetchJson(url, headers = {}) {
  const r = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
  const text = await r.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text.slice(0, 400) };
  }
  return { ok: r.ok, status: r.status, json };
}

function sectionsFrom(payload) {
  const expl = payload?.explainer ?? payload;
  return expl?.sections || [];
}

function musicalSection(sections) {
  return sections.find((s) => s.id === 'musical' || s.id === 'music_translation') || null;
}

function collectProvenance(tagged) {
  const out = [];
  if (!tagged?.paragraphs) return out;
  for (const p of tagged.paragraphs) {
    for (const s of p.sentences || []) {
      out.push(s.provenance || '');
    }
  }
  return out;
}

async function profileChart(base, label) {
  const headers = base.includes('vercel.app') && BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {};
  const { ok, status, json } = await fetchJson(`${base}${CHART_URL_PATH}`, headers);
  assert(ok, `${label}: HTTP ${status}`);
  const sections = sectionsFrom(json);
  assert(sections.length > 0, `${label}: no sections`);
  const mus = musicalSection(sections);
  assert(mus, `${label}: missing musical / music_translation section`);
  return { sections, mus, raw: json };
}

async function main() {
  const results = {
    A_render_health: null,
    B_vercel_reachability: null,
    C_claim_ids_render: null,
    D_arc_tagging: null,
    E_no_template_contamination: null,
    F_no_pattern_note_in_musical: null,
    G_determinism: null,
    H_cross_surface: null,
  };

  // A — Render health
  const health = await fetchJson(`${RENDER}/api/compat/health`);
  results.A_render_health = {
    ok: health.ok && health.json?.status === 'healthy',
    status: health.status,
    body: health.json?.status || health.json,
  };

  // B — Vercel reachability (protected routes need bypass)
  const vercelPing = await fetchJson(`${VERCEL}${CHART_URL_PATH}`, BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {});
  results.B_vercel_reachability = {
    ok: vercelPing.ok,
    status: vercelPing.status,
    bypass_header_sent: Boolean(BYPASS),
  };
  if (!BYPASS) {
    console.warn('[music-translation-live-smoke] VERCEL_BYPASS_TOKEN not set; Vercel may 401.');
  }

  const r1 = await profileChart(RENDER, 'Render#1');
  const r2 = await profileChart(RENDER, 'Render#2');
  const v1 = await profileChart(VERCEL, 'Vercel#1');
  const v2 = await profileChart(VERCEL, 'Vercel#2');

  const musR = r1.mus;
  const musV = v1.mus;

  // C — claim id arrays present and stable (live JSON includes meta from engine)
  const idsR = musR.meta?.claimIdsReferenced;
  const idsV = musV.meta?.claimIdsReferenced;
  results.C_claim_ids_render = {
    render_has_claim_ids: Array.isArray(idsR) && idsR.length > 0,
    vercel_has_claim_ids: Array.isArray(idsV) && idsV.length > 0,
    render_ids: idsR,
    vercel_ids: idsV,
    render_equals_vercel_ids: JSON.stringify(idsR) === JSON.stringify(idsV),
  };

  // D — arc: musical body provenance should be claim_body only (no template in body sentences)
  const provR = collectProvenance(musR.meta?.tagged);
  const forbidden = new Set(['template', 'tier_scaffold', 'synthesis_wrapper', 'audio_staging']);
  const bad = provR.filter((p) => forbidden.has(p));
  results.D_arc_tagging = {
    sentence_provenance_count: provR.length,
    non_claim_body_in_body: bad,
    ok: provR.length > 0 && bad.length === 0,
  };

  const textR = musR.text || '';
  const textV = musV.text || '';

  // E — no legacy template contamination
  results.E_no_template_contamination = {
    render_ok: !textR.includes(' as timbre') && !textR.includes('Listen detail lives'),
    vercel_ok: !textV.includes(' as timbre') && !textV.includes('Listen detail lives'),
  };

  // F — no supplemental “pattern note” copy in musical body
  results.F_no_pattern_note_in_musical = {
    render_ok: !textR.includes('Pattern note'),
    vercel_ok: !textV.includes('Pattern note'),
  };

  // G — determinism (two consecutive fetches per host)
  results.G_determinism = {
    render_same_text: r1.mus.text === r2.mus.text,
    render_same_ids: JSON.stringify(r1.mus.meta?.claimIdsReferenced) === JSON.stringify(r2.mus.meta?.claimIdsReferenced),
    vercel_same_text: v1.mus.text === v2.mus.text,
    vercel_same_ids: JSON.stringify(v1.mus.meta?.claimIdsReferenced) === JSON.stringify(v2.mus.meta?.claimIdsReferenced),
  };

  // H — same chart → same musical alignment across surfaces
  results.H_cross_surface = {
    same_text: textR === textV,
    same_claim_ids: JSON.stringify(idsR) === JSON.stringify(idsV),
  };

  const pass =
    results.A_render_health.ok &&
    results.B_vercel_reachability.ok &&
    results.C_claim_ids_render.render_has_claim_ids &&
    results.C_claim_ids_render.vercel_has_claim_ids &&
    results.D_arc_tagging.ok &&
    results.E_no_template_contamination.render_ok &&
    results.E_no_template_contamination.vercel_ok &&
    results.F_no_pattern_note_in_musical.render_ok &&
    results.F_no_pattern_note_in_musical.vercel_ok &&
    results.G_determinism.render_same_text &&
    results.G_determinism.render_same_ids &&
    results.G_determinism.vercel_same_text &&
    results.G_determinism.vercel_same_ids &&
    results.H_cross_surface.same_text &&
    results.H_cross_surface.same_claim_ids;

  console.log(JSON.stringify({ pass, results }, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error('[music-translation-live-smoke] FATAL', e.message);
  process.exit(1);
});
