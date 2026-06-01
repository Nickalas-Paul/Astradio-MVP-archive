#!/usr/bin/env node
/**
 * Live smoke: group sandbox aggregate text quality (hedge spam, dedupe, ensemble framing).
 * Usage: ENGINE_BASE_URL=https://astradio-mvp-archive.onrender.com node vnext/scripts/smoke-text-quality-group-live.mjs
 */
import { checkForBannedStrings } from './smoke-template-removal.mjs';

const BASE = (process.env.ENGINE_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const HEDGE = 'In many cases, this pattern tends to show related tendencies:';
const ENFORCE_TEMPLATE_REMOVAL = process.env.SMOKE_TEMPLATE_REMOVAL_ENFORCE === '1';
const EXPECTED_SECTIONS = ['group_key_interactions_v1'];
const BANNED_SECTIONS = [
  'musical',
  'audio_thread',
  'temporal_integration',
  'trait_bridge',
  'interaction_map',
  'field_distribution',
  'pressure_response',
  'layering',
  'delta_emphasis',
  'contradiction_map',
  'subcluster',
];

const birth = (date, lonShift = 0) => ({
  date,
  time: '12:00',
  lat: 37.7749 + lonShift * 0.01,
  lon: -122.4194 + lonShift * 0.01,
});

const controls = {
  arc_shape: 0.5,
  density_level: 0.6,
  tempo_norm: 0.7,
  step_bias: 0.7,
  leap_cap: 5,
  rhythm_template_id: 3,
  syncopation_bias: 0.3,
  motif_rate: 0.6,
};

async function main() {
  console.log(`[smoke-text-quality] BASE=${BASE}`);
  const health = await fetch(`${BASE}/health`);
  if (!health.ok) {
    console.error(`FAIL: /health ${health.status}`);
    process.exit(1);
  }

  const resolveBody = {
    schema_version: '1',
    slots: [
      { ephemeris_birth: birth('1990-01-15', 0), overrides: { planets: {} } },
      { ephemeris_birth: birth('1988-07-22', 1), overrides: { planets: {} } },
      { ephemeris_birth: birth('1995-11-30', 2), overrides: { planets: {} } },
    ],
    active_slot_index: 0,
    compose_controls: controls,
    output_kind: 'full',
    seed: 'text-quality-smoke-group-20260509',
  };

  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/sandbox/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resolveBody),
  });
  const elapsed = Date.now() - t0;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`FAIL: resolve status=${res.status}`, JSON.stringify(json).slice(0, 800));
    process.exit(1);
  }

  if (json.composition_mode !== 'group_aggregate') {
    console.error(`FAIL: expected composition_mode group_aggregate got ${json.composition_mode}`);
    process.exit(1);
  }

  const sections = json.aggregate?.explanation?.sections;
  if (!Array.isArray(sections)) {
    console.error('FAIL: missing aggregate.explanation.sections');
    process.exit(1);
  }

  const report = {
    elapsed_ms: elapsed,
    composition_mode: json.composition_mode,
    tests: {},
  };

  // Test 3: no ensemble framing
  const ensemble = sections.find((s) => s.id === 'ensemble_framing');
  report.tests.framing_removed = !ensemble;
  if (ensemble) {
    console.error('FAIL Test 3: ensemble_framing present (sandbox should suppress)');
    process.exit(1);
  }

  // Test 1: no hedge spam in Key interactions
  const ki = sections.find((s) => s.id === 'group_key_interactions_v1');
  const kiText = ki?.text || '';
  report.tests.key_interactions_present = !!ki;
  report.tests.hedge_prefix_absent = !kiText.includes(HEDGE);
  if (ki && kiText.includes(HEDGE)) {
    console.error('FAIL Test 1: hedge prefix found in group_key_interactions_v1');
    process.exit(1);
  }

  if (!ki) {
    report.tests.key_interactions_skipped_reason =
      'Phase 6E Key Interactions require aggregateParticipantLabelsV1 (saved chart slots); birth-only slots omit KI — validate hedge/dedupe via charts with IDs or local projection fixture.';
    report.section_ids = sections.map((s) => s.sectionId ?? s.id ?? null);
  }

  const sectionIds = sections.map((s) => s.sectionId ?? s.id ?? null).filter(Boolean);
  const reportText = sections.map((s) => [s.text, ...(s.bullets ?? [])].filter(Boolean).join('\n')).join('\n\n');
  const banCheck = await checkForBannedStrings(reportText);
  report.tests.template_ban_check = {
    pass: banCheck.pass,
    found: banCheck.found,
    enforce: ENFORCE_TEMPLATE_REMOVAL,
  };
  report.tests.expected_sections_present = EXPECTED_SECTIONS.filter((id) => sectionIds.includes(id));
  report.tests.banned_sections_present = BANNED_SECTIONS.filter((id) => sectionIds.includes(id));

  if (!banCheck.pass && ENFORCE_TEMPLATE_REMOVAL) {
    console.error('FAIL: banned template strings found:');
    for (const str of banCheck.found) console.error(`  - "${str}"`);
    process.exit(1);
  }

  if (report.tests.banned_sections_present.length > 0 && ENFORCE_TEMPLATE_REMOVAL) {
    console.error('FAIL: banned section ids found:');
    for (const id of report.tests.banned_sections_present) console.error(`  - ${id}`);
    process.exit(1);
  }

  // Test 2: no verbatim duplicate synastry bodies (reciprocal dupes share identical library text)
  if (kiText) {
    const blocks = kiText.split(/\n---\n/).map((b) => b.trim()).filter(Boolean);
    report.tests.key_interaction_blocks = blocks.length;
    const bodies = blocks.map((b) => {
      const idx = b.indexOf('\n\n');
      return idx === -1 ? '' : b.slice(idx + 2).trim();
    });
    const seen = new Set();
    for (const body of bodies) {
      if (body.length < 60) continue;
      if (seen.has(body)) {
        console.error('FAIL Test 2: duplicate synastry body (reciprocal not deduped)');
        process.exit(1);
      }
      seen.add(body);
    }
    report.tests.no_duplicate_synastry_bodies = true;
  }

  // Ordering: first section should not be ensemble when framing removed; often compatActivation empty → key interactions early
  report.first_section_id = sections[0]?.id;

  console.log(JSON.stringify(report, null, 2));
  console.log('SMOKE TEXT QUALITY GROUP PASS');

  // Test 5 (pair regression): two birth slots → pair_aggregate, no Key interactions section
  const pairBody = {
    schema_version: '1',
    slots: [
      { ephemeris_birth: birth('1991-05-01', 0), overrides: { planets: {} } },
      { ephemeris_birth: birth('1993-09-09', 1), overrides: { planets: {} } },
    ],
    active_slot_index: 0,
    compose_controls: controls,
    output_kind: 'full',
    seed: 'text-quality-smoke-pair-20260509',
  };
  const pairRes = await fetch(`${BASE}/api/sandbox/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pairBody),
  });
  const pairJson = await pairRes.json().catch(() => ({}));
  if (!pairRes.ok) {
    console.error(`FAIL pair: resolve ${pairRes.status}`, JSON.stringify(pairJson).slice(0, 600));
    process.exit(1);
  }
  if (pairJson.composition_mode !== 'pair_aggregate') {
    console.error(`FAIL pair: expected pair_aggregate got ${pairJson.composition_mode}`);
    process.exit(1);
  }
  const pairSecs = pairJson.aggregate?.explanation?.sections;
  const pairKi = Array.isArray(pairSecs) && pairSecs.some((s) => s.id === 'group_key_interactions_v1');
  if (pairKi) {
    console.error('FAIL Test 5: pair_aggregate should not emit group_key_interactions_v1');
    process.exit(1);
  }
  console.log(JSON.stringify({ pair_regression: { composition_mode: pairJson.composition_mode, key_interactions_absent: true } }));
  console.log('SMOKE PAIR REGRESSION PASS');

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
