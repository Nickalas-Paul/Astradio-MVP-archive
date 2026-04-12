/**
 * Phase 5A / 5B — surface expression filters (local CI).
 * Sentence invariants, template allowlist, glue load neutrality, feed length, determinism, tagged reconstruct, hash contracts.
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectedExplanationSection, ProjectionOptions, TaggedSectionBody } from '../projection/projection-types';
import { assertSectionTaggedInvariant, reconstructTaggedSectionBody, splitSentsForTagged, stripTaggedFromExplanationForHash } from '../projection/tagged-text';
import { applyPhase5AExpression, applyPhase5AExpressionWithTables, type Phase5AEngineTables } from '../projection/rule-layer/phase5a-engine';
import type { Phase5ARule, Phase5ATemplateAllowlistEntry } from '../projection/rule-layer/phase5a-tables';
import { PHASE5A_RULES, PHASE5A_TEMPLATE_ALLOWLIST } from '../projection/rule-layer/phase5a-tables';
import { PHASE5B_RULES } from '../rpg/phase5b-tables';
import { applyPhase5BLineArray, applyPhase5BLineArrayWithTables, applyPhase5BWholeTextWithTables } from '../rpg/phase5b-engine';
import type { Phase5BRule } from '../rpg/phase5b-tables';
import { countSentenceLoads, totalLoadScore } from '../projection/rule-layer/phase2-sentence-load';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-phase5-expression-filters] ${msg}`);
}

function snap(): EphemerisSnapshot {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 45 },
      { name: 'Mercury', lon: 60 },
      { name: 'Venus', lon: 75 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 120 },
      { name: 'Uranus', lon: 135 },
      { name: 'Neptune', lon: 150 },
      { name: 'Pluto', lon: 165 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function syntheticSection(tagged: TaggedSectionBody): ProjectedExplanationSection {
  return {
    id: 'phase5_synthetic',
    title: 'Synthetic',
    text: reconstructTaggedSectionBody(tagged),
    meta: { claimIdsReferenced: [], phaseD: true, tagged },
  };
}

function explanationShape(sections: ProjectedExplanationSection[]): Record<string, unknown> {
  return {
    sections: sections.map((s) => ({
      id: s.id,
      title: s.title,
      text: s.text,
      bullets: s.bullets,
      meta: s.meta,
    })),
  };
}

function sentenceCountsInText(text: string): number[] {
  return splitParas(text).map((p) => splitSentsForTagged(p).length);
}

function splitParas(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function main(): void {
  const tables5a: Phase5AEngineTables = {
    rules: [
      {
        rule_id: 'P5A-z-second',
        surfaces: ['*'],
        provenances: ['synthesis_wrapper'],
        match: { kind: 'whole_sentence', before: 'second line.' },
        replacement: 'second LINE.',
      },
      {
        rule_id: 'P5A-a-first',
        surfaces: ['*'],
        provenances: ['synthesis_wrapper'],
        match: { kind: 'whole_sentence', before: 'first line.' },
        replacement: 'first LINE.',
      },
    ],
    templateAllowlist: [],
  };

  const tagged: TaggedSectionBody = {
    paragraphs: [
      {
        sentences: [
          { text: 'first line.', provenance: 'synthesis_wrapper' },
          { text: 'second line.', provenance: 'synthesis_wrapper' },
          { text: 'claim stays.', provenance: 'claim_body' },
          { text: 'template stays.', provenance: 'template' },
        ],
      },
    ],
  };

  const sec = syntheticSection(tagged);
  const opts: ProjectionOptions = { surface: 'profile', tier: 'baseline', narrativePlan: null };
  const out = applyPhase5AExpressionWithTables([sec], opts, tables5a);

  assert(out[0]!.text.includes('first LINE.'), 'lexicographic rule order: P5A-a-first before P5A-z-second');
  assert(out[0]!.text.includes('second LINE.'), 'second rule applied');
  assert(out[0]!.text.includes('claim stays.'), 'claim_body immutable');
  assert(out[0]!.text.includes('template stays.'), 'template immutable without allowlist');
  assertSectionTaggedInvariant(out[0]!, 'phase5-synthetic');

  const scBefore = sentenceCountsInText(sec.text);
  const scAfter = sentenceCountsInText(out[0]!.text);
  assert(JSON.stringify(scBefore) === JSON.stringify(scAfter), 'sentence count per paragraph invariant');

  const tplAllow: Phase5ATemplateAllowlistEntry[] = [
    {
      exception_id: 'TE-0001',
      surface: '*',
      match: { kind: 'whole_sentence', value: 'template stays.' },
      replacement: 'template KEPT.',
    },
  ];
  const out2 = applyPhase5AExpressionWithTables([sec], opts, { rules: [], templateAllowlist: tplAllow });
  assert(out2[0]!.text.includes('template KEPT.'), 'template allowlist applies');
  assert(!out2[0]!.text.includes('template stays.'), 'template replaced');

  const glueSentence = 'ZZZ middle tail.';
  const glueAfter = 'AAA middle tail.';
  assert(
    totalLoadScore(countSentenceLoads(glueSentence, 'template')) === totalLoadScore(countSentenceLoads(glueAfter, 'template')),
    'glue pair load-neutral fixture'
  );
  const glueTagged: TaggedSectionBody = {
    paragraphs: [{ sentences: [{ text: glueSentence, provenance: 'assembler_glue' }] }],
  };
  const glueRules: Phase5ARule[] = [
    {
      rule_id: 'P5A-glue',
      surfaces: ['*'],
      provenances: ['assembler_glue'],
      match: { kind: 'prefix', before_prefix: 'ZZZ', after_prefix: 'AAA' },
      replacement: '',
    },
  ];
  const outGlue = applyPhase5AExpressionWithTables([syntheticSection(glueTagged)], opts, {
    rules: glueRules,
    templateAllowlist: [],
  });
  assert(outGlue[0]!.text.trim() === glueAfter.trim(), 'prefix glue substitution');
  assertSectionTaggedInvariant(outGlue[0]!, 'glue');

  const feedOpts: ProjectionOptions = { surface: 'feed', tier: 'baseline', narrativePlan: null };
  const feedRules: Phase5ARule[] = [
    {
      rule_id: 'P5A-feed-long',
      surfaces: ['feed'],
      provenances: ['synthesis_wrapper'],
      match: { kind: 'whole_sentence', before: 'short.' },
      replacement: 'this is far too long to apply on feed.',
    },
    {
      rule_id: 'P5A-feed-ok',
      surfaces: ['feed'],
      provenances: ['synthesis_wrapper'],
      match: { kind: 'whole_sentence', before: 'short.' },
      replacement: 'tiny.',
    },
  ];
  const feedTagged: TaggedSectionBody = {
    paragraphs: [{ sentences: [{ text: 'short.', provenance: 'synthesis_wrapper' }] }],
  };
  const outFeed = applyPhase5AExpressionWithTables([syntheticSection(feedTagged)], feedOpts, {
    rules: feedRules,
    templateAllowlist: [],
  });
  assert(outFeed[0]!.text.trim() === 'tiny.', 'feed picks first non-expanding rule');
  assert(outFeed[0]!.text.length <= 'short.'.length, 'feed non-increasing length');

  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'p5');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['p5'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  const hCanon = canonical.object_identity_hash;
  const core = interpretCanonicalReportObject(canonical);
  const projOpts: ProjectionOptions = { phaseD: true, surface: 'profile', tier: 'baseline', narrativePlan: null };
  const projected = projectTextFromSemanticCore(core, 'p5-hash', projOpts);
  const emptyPass = applyPhase5AExpressionWithTables(projected, projOpts, { rules: [], templateAllowlist: [] });
  assert(JSON.stringify(projected) === JSON.stringify(emptyPass), 're-applying empty rule tables is a no-op on current projection');
  const canonical2 = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['p5'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  assert(canonical.object_identity_hash === canonical2.object_identity_hash, 'canonical hash reproducible');
  assert(hCanon === canonical.object_identity_hash, 'canonical hash stable under projection+empty phase5');
  void core;
  const explBefore = stripTaggedFromExplanationForHash(explanationShape(projected) as Record<string, unknown>);
  const explAfter = stripTaggedFromExplanationForHash(explanationShape(emptyPass) as Record<string, unknown>);
  assert(JSON.stringify(explBefore) === JSON.stringify(explAfter), 'explanation strip unchanged with empty phase5 tables');

  const bRules: Phase5BRule[] = [
    {
      rule_id: 'P5B-001-winner',
      emission_id: 'e1',
      match: { kind: 'whole_text', before: 'alpha' },
      replacement: 'ALPHA',
    },
    {
      rule_id: 'P5B-002-ignored',
      emission_id: 'e1',
      match: { kind: 'whole_text', before: 'alpha' },
      replacement: 'WRONG',
    },
  ];
  const tables5b = { rules: bRules };
  assert(applyPhase5BWholeTextWithTables('e1', 'alpha', tables5b) === 'ALPHA', '5B lexicographic first match');
  const lines = applyPhase5BLineArrayWithTables('e1', ['alpha', 'beta'], tables5b);
  assert(lines.length === 2, '5B line array same length');
  assert(lines[0] === 'ALPHA' && lines[1] === 'beta', '5B per-line');

  const bRulesSentence: Phase5BRule[] = [
    {
      rule_id: 'P5B-bad',
      emission_id: 'e2',
      match: { kind: 'whole_text', before: 'One. Two.' },
      replacement: 'Only one.',
    },
  ];
  let threw = false;
  try {
    applyPhase5BWholeTextWithTables('e2', 'One. Two.', { rules: bRulesSentence });
  } catch {
    threw = true;
  }
  assert(threw, '5B rejects sentence-count change');

  wave1ShippedTablesVerification();

  console.log('[test-phase5-expression-filters] OK');
}

/** Phase 5C — shipped `phase5a-tables` / `phase5b-tables` invariants (Wave 1 + Wave 2 caps, glue load, feed length, preface dupes). */
function wave1ShippedTablesVerification(): void {
  const wave2a = PHASE5A_RULES.filter((r) => r.rule_id.includes('-W2-'));
  const wave2b = PHASE5B_RULES.filter((r) => r.rule_id.includes('-W2-'));
  assert(wave2a.length === 16, `expected 16 Wave 2 Phase5A rules, got ${wave2a.length}`);
  assert(wave2b.length === 10, `expected 10 Wave 2 Phase5B rules, got ${wave2b.length}`);
  assert(wave2a.length + wave2b.length <= 28, 'Wave 2 new rule rows must stay within the 28-row cap (5A+5B)');

  const waveTotal = PHASE5A_RULES.length + PHASE5A_TEMPLATE_ALLOWLIST.length + PHASE5B_RULES.length;
  assert(waveTotal <= 45, `cumulative Phase5 rows ${waveTotal} must stay controlled`);

  for (const ex of PHASE5A_TEMPLATE_ALLOWLIST) {
    if (ex.match.kind === 'whole_sentence') {
      assert(
        ex.replacement.length <= ex.match.value.length,
        `feed allowlist ${ex.exception_id}: replacement must be <= original (${ex.replacement.length} vs ${ex.match.value.length})`
      );
    }
  }

  const glueRules = PHASE5A_RULES.filter((r) => r.match.kind === 'prefix');
  assert(glueRules.length === 4, `expected 4 prefix glue rules (profile + 3 Wave 2 surfaces), got ${glueRules.length}`);
  const profileGlue = glueRules.find((r) => r.rule_id === 'P5A-W1-001-glue-profile-baseline-prefix');
  assert(profileGlue !== undefined, 'wave1 profile glue rule present');
  assert(
    profileGlue!.surfaces.length === 1 && profileGlue!.surfaces[0] === 'profile',
    'wave1 glue remains profile-only'
  );
  const glueFixtures: Array<{ rule_id: string; full: string }> = [
    { rule_id: 'P5A-W1-001-glue-profile-baseline-prefix', full: 'In this chart, you see a baseline personal picture.' },
    { rule_id: 'P5A-W2-001-glue-campaign-scenario-stable-prefix', full: 'In this scenario, you see a stable story beat.' },
    { rule_id: 'P5A-W2-002-glue-compat-baseline-prefix', full: 'For this connection, you see a baseline contact tone.' },
    { rule_id: 'P5A-W2-003-glue-daily-baseline-prefix', full: 'In this chart, you see a baseline personal picture.' },
  ];
  for (const fx of glueFixtures) {
    const gr = glueRules.find((r) => r.rule_id === fx.rule_id);
    assert(gr !== undefined, `glue rule ${fx.rule_id}`);
    const m = gr!.match as { kind: 'prefix'; before_prefix: string; after_prefix: string };
    assert(fx.full.startsWith(m.before_prefix), `glue fixture prefix ${fx.rule_id}`);
    const afterGlue = m.after_prefix + fx.full.slice(m.before_prefix.length);
    assert(
      totalLoadScore(countSentenceLoads(fx.full, 'template')) ===
        totalLoadScore(countSentenceLoads(afterGlue, 'template')),
      `glue load neutrality ${fx.rule_id}`
    );
    assert(splitSentsForTagged(fx.full).length === splitSentsForTagged(afterGlue).length, `glue sentence count ${fx.rule_id}`);
  }

  for (const br of PHASE5B_RULES) {
    assert(br.emission_id === 'rpg_continuity_lines_v1', '5B rules target continuity line emission');
    if (br.match.kind === 'whole_text') {
      const nb = splitSentsForTagged(br.match.before).length;
      const na = splitSentsForTagged(br.replacement).length;
      assert(nb === na, `5B ${br.rule_id} sentence count ${nb}->${na}`);
    }
  }

  const histBefore = 'It also echoes a recent pattern of defining the situation rather than leaving it implied.';
  const histOut = applyPhase5BWholeTextWithTables('rpg_continuity_lines_v1', histBefore, { rules: PHASE5B_RULES });
  assert(histOut !== histBefore, 'Wave 2 history-direction line mutates when matched');

  for (const r of PHASE5A_RULES) {
    if (r.surfaces.includes('feed') && r.match.kind === 'whole_sentence') {
      const bef = r.match.before;
      const rep = r.replacement;
      assert(rep.length <= bef.length, `feed rule ${r.rule_id} must be non-expanding (${rep.length} vs ${bef.length})`);
    }
  }

  const prefaceObsTagged: TaggedSectionBody = {
    paragraphs: [
      {
        sentences: [{ text: 'The sections stay observational.', provenance: 'preface' }],
      },
    ],
  };
  const prefaceOpts: ProjectionOptions = { surface: 'compat_pair', tier: 'baseline', narrativePlan: null, connectionMode: 'friends' };
  const prefaceOut = applyPhase5AExpressionWithTables([syntheticSection(prefaceObsTagged)], prefaceOpts, {
    rules: PHASE5A_RULES,
    templateAllowlist: PHASE5A_TEMPLATE_ALLOWLIST,
  });
  assert(
    prefaceOut[0]!.text.includes('steady, plain language'),
    'shared observational preface rule applies on compat_pair friends'
  );

  const situTagged: TaggedSectionBody = {
    paragraphs: [{ sentences: [{ text: 'Language stays situational.', provenance: 'preface' }] }],
  };
  const situLoversOpts: ProjectionOptions = {
    surface: 'compat_pair',
    tier: 'baseline',
    narrativePlan: null,
    connectionMode: 'lovers',
  };
  const situOut = applyPhase5AExpressionWithTables([syntheticSection(situTagged)], situLoversOpts, {
    rules: PHASE5A_RULES,
    templateAllowlist: PHASE5A_TEMPLATE_ALLOWLIST,
  });
  assert(situOut[0]!.text.includes('in the moment'), 'situational preface rule applies for lovers');

  const situRivalsOpts: ProjectionOptions = { ...prefaceOpts, connectionMode: 'rivals' };
  const situRivalsOut = applyPhase5AExpressionWithTables([syntheticSection(situTagged)], situRivalsOpts, {
    rules: PHASE5A_RULES,
    templateAllowlist: PHASE5A_TEMPLATE_ALLOWLIST,
  });
  assert(situRivalsOut[0]!.text === reconstructTaggedSectionBody(situTagged).trim(), 'situational preface skipped for rivals');

  const contBefore =
    'Recent turns have leaned toward naming things plainly and defining the line more clearly.';
  const contOut = applyPhase5BLineArray('rpg_continuity_lines_v1', [contBefore]);
  assert(contOut[0] !== contBefore, 'shipped 5B continuity mutates clarity line');
  assert(splitSentsForTagged(contBefore).length === splitSentsForTagged(contOut[0]!).length, 'continuity line sentence invariant');

  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'w1wave');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['w1'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);

  const friendsText =
    applyPhase5AExpression(
      projectTextFromSemanticCore(core, 'mode-diff', {
        phaseD: true,
        surface: 'compat_pair',
        tier: 'expanded',
        connectionMode: 'friends',
        narrativePlan: null,
      }),
      { surface: 'compat_pair', tier: 'expanded', connectionMode: 'friends', narrativePlan: null }
    )
      .find((s) => s.id === 'connection_structure')?.text ?? '';
  const loversText =
    applyPhase5AExpression(
      projectTextFromSemanticCore(core, 'mode-diff', {
        phaseD: true,
        surface: 'compat_pair',
        tier: 'expanded',
        connectionMode: 'lovers',
        narrativePlan: null,
      }),
      { surface: 'compat_pair', tier: 'expanded', connectionMode: 'lovers', narrativePlan: null }
    )
      .find((s) => s.id === 'connection_structure')?.text ?? '';
  assert(friendsText.length > 0 && loversText.length > 0, 'compat_pair connection_structure present for intent test');
  assert(friendsText !== loversText, 'compat intent differentiation: friends vs lovers preface differs');

  const campSyn = applyPhase5AExpression(
    projectTextFromSemanticCore(core, 'camp-syn', { phaseD: true, surface: 'campaign', tier: 'expanded', narrativePlan: null }),
    { surface: 'campaign', tier: 'expanded', narrativePlan: null }
  )
    .map((s) => s.text)
    .join('\n');
  assert(
    campSyn.includes('without overwriting it') || campSyn.includes('read as situational'),
    'Wave 2 campaign-only synthesis wrapper applies'
  );

  const sbOpts: ProjectionOptions = { phaseD: true, surface: 'sandbox', tier: 'extended', narrativePlan: null };
  const sb1 = projectTextFromSemanticCore(core, 'wave1-det', sbOpts);
  const sb2 = projectTextFromSemanticCore(core, 'wave1-det', sbOpts);
  assert(JSON.stringify(sb1) === JSON.stringify(sb2), 'wave1 sandbox extended deterministic');
  const joined = sb1.map((s) => s.text).join('\n');
  assert(joined.includes('Lab framing:'), 'wave1 sandbox lab synthesis applied');
  assert(
    joined.includes('Expanded sandbox pass adds second-order effects for edge-condition sensitivity in the lab.'),
    'wave1 sandbox tier scaffold applied'
  );
  for (const s of sb1) assertSectionTaggedInvariant(s, 'wave1-sandbox');

  const feedOpts: ProjectionOptions = { phaseD: true, surface: 'feed', tier: 'baseline', narrativePlan: null };
  const feedSec = projectTextFromSemanticCore(core, 'wave1-feed', feedOpts);
  const scope = feedSec.find((s) => s.id === 'feed_context')?.text ?? '';
  assert(scope.includes('This card stays tight by design.'), 'wave1 feed template allowlist applied');
  assert(!scope.includes('This card stays narrow by design.'), 'wave1 feed original scope line replaced');
  for (const s of feedSec) assertSectionTaggedInvariant(s, 'wave1-feed');

  const profOpts: ProjectionOptions = { phaseD: true, surface: 'profile', tier: 'baseline', narrativePlan: null };
  const prof = projectTextFromSemanticCore(core, 'wave1-prof', profOpts);
  const profJoined = prof.map((s) => s.text).join('\n');
  if (profJoined.includes('In this chart, you see a baseline personal picture.')) {
    assert(profJoined.includes('steadier'), 'wave1 profile glue prefix applied when baseline anchor present');
  }
  const prof2 = applyPhase5AExpression(prof, profOpts);
  assert(JSON.stringify(prof) === JSON.stringify(prof2), 'applyPhase5AExpression idempotent on shipped rules');
}

main();
