/**
 * Projection surface expression rules and RPG line filters (local CI).
 * Sentence invariants, template allowlist, glue load neutrality, feed length, determinism, tagged reconstruct, hash contracts.
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForAggregate, buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { mergeFeatureVectors } from '../compat/fusion';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectedExplanationSection, ProjectionOptions, TaggedSectionBody } from '../projection/projection-types';
import { assertSectionTaggedInvariant, reconstructTaggedSectionBody, splitSentsForTagged, stripTaggedFromExplanationForHash } from '../projection/tagged-text';
import {
  applySurfaceExpressionRules,
  applySurfaceExpressionRulesWithTables,
  type SurfaceExpressionEngineTables,
} from '../projection/rule-layer/surface-expression-engine';
import type { SurfaceExpressionRule, SurfaceExpressionTemplateAllowlistEntry } from '../projection/rule-layer/surface-expression-tables';
import {
  SHIPPED_SURFACE_EXPRESSION_RULES,
  SHIPPED_SURFACE_EXPRESSION_TEMPLATE_ALLOWLIST,
} from '../projection/rule-layer/surface-expression-tables';
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
    id: 'expr_synthetic_section',
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

function collectClaimBodyTexts(sections: ProjectedExplanationSection[]): string[] {
  const acc: string[] = [];
  function walk(body: TaggedSectionBody | undefined): void {
    if (!body) return;
    for (const para of body.paragraphs) {
      for (const row of para.sentences) {
        if (row.provenance === 'claim_body') acc.push(row.text);
      }
    }
    if (body.bulletBlocks) {
      for (const bb of body.bulletBlocks) walk(bb);
    }
  }
  for (const sec of sections) walk(sec.meta?.tagged);
  return [...acc].sort((a, b) => a.localeCompare(b));
}

function surfaceExpressionClaimBodyAndVoiceInvariants(
  core: ReturnType<typeof interpretCanonicalReportObject>
): void {
  const opts: ProjectionOptions = { phaseD: true, surface: 'profile', tier: 'extended', narrativePlan: null };
  const projected = projectTextFromSemanticCore(core, 'expr-cb-inv', opts);
  const before = collectClaimBodyTexts(projected);
  const afterProj = applySurfaceExpressionRules(
    JSON.parse(JSON.stringify(projected)) as ProjectedExplanationSection[],
    opts
  );
  assert(
    JSON.stringify(before) === JSON.stringify(collectClaimBodyTexts(afterProj)),
    'claim_body untouched by surface expression pass'
  );

  for (const domFlag of [false, true] as const) {
    const o: ProjectionOptions = { ...opts, mechanismExpressionDominantSignals: domFlag };
    const p0 = projectTextFromSemanticCore(core, `expr-dom-${String(domFlag)}`, o);
    const p1 = applySurfaceExpressionRules(JSON.parse(JSON.stringify(p0)) as ProjectedExplanationSection[], o);
    assert(
      JSON.stringify(collectClaimBodyTexts(p0)) === JSON.stringify(collectClaimBodyTexts(p1)),
      `claim_body stable with mechanismExpressionDominantSignals=${String(domFlag)}`
    );
  }

  const matrixSurfaces: Array<{ surface: 'profile' | 'sandbox' | 'group' | 'campaign'; participantCount?: number }> = [
    { surface: 'profile' },
    { surface: 'sandbox' },
    { surface: 'group', participantCount: 3 },
    { surface: 'campaign' },
  ];
  for (const domFlag of [false, true] as const) {
    for (const spec of matrixSurfaces) {
      const surfaceOpts: ProjectionOptions = {
        phaseD: true,
        surface: spec.surface,
        tier: 'extended',
        narrativePlan: null,
        mechanismExpressionDominantSignals: domFlag,
        ...(spec.participantCount ? { participantCount: spec.participantCount } : {}),
      };
      const beforeSurface = projectTextFromSemanticCore(core, `expr-cb-${spec.surface}-${String(domFlag)}`, surfaceOpts);
      const afterSurface = applySurfaceExpressionRules(
        JSON.parse(JSON.stringify(beforeSurface)) as ProjectedExplanationSection[],
        surfaceOpts
      );
      assert(
        JSON.stringify(collectClaimBodyTexts(beforeSurface)) === JSON.stringify(collectClaimBodyTexts(afterSurface)),
        `claim_body immutable for surface=${spec.surface} dominant=${String(domFlag)}`
      );
    }
  }

  const pOpts: ProjectionOptions = { phaseD: true, surface: 'profile', tier: 'expanded', narrativePlan: null };
  const sOpts: ProjectionOptions = { phaseD: true, surface: 'sandbox', tier: 'expanded', narrativePlan: null };
  const pSyn =
    applySurfaceExpressionRules(projectTextFromSemanticCore(core, 'surf-p', pOpts), pOpts).find((s) => s.id === 'synthesis_a')
      ?.text ?? '';
  const sSyn =
    applySurfaceExpressionRules(projectTextFromSemanticCore(core, 'surf-s', sOpts), sOpts).find((s) => s.id === 'synthesis_a')
      ?.text ?? '';
  if (pSyn.length > 0 && sSyn.length > 0) {
    assert(pSyn !== sSyn, 'profile vs sandbox synthesis_a text differs');
    assert(
      pSyn.includes('personal nuance') || pSyn.includes('same personal picture'),
      'profile synthesis_a carries profile-scoped voice'
    );
    assert(
      sSyn.includes('lab snapshot') || sSyn.includes('inputs you set'),
      'sandbox synthesis_a carries sandbox-scoped voice'
    );
  }
}

function main(): void {
  const tables5a: SurfaceExpressionEngineTables = {
    rules: [
      {
        rule_id: 'expr-lex-second',
        surfaces: ['*'],
        provenances: ['synthesis_wrapper'],
        match: { kind: 'whole_sentence', before: 'second line.' },
        replacement: 'second LINE.',
      },
      {
        rule_id: 'expr-lex-first',
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
  const out = applySurfaceExpressionRulesWithTables([sec], opts, tables5a);

  assert(out[0]!.text.includes('first LINE.'), 'lexicographic rule order: expr-lex-first before expr-lex-second');
  assert(out[0]!.text.includes('second LINE.'), 'second rule applied');
  assert(out[0]!.text.includes('claim stays.'), 'claim_body immutable');
  assert(out[0]!.text.includes('template stays.'), 'template immutable without allowlist');
  assertSectionTaggedInvariant(out[0]!, 'expr-synthetic');

  const scBefore = sentenceCountsInText(sec.text);
  const scAfter = sentenceCountsInText(out[0]!.text);
  assert(JSON.stringify(scBefore) === JSON.stringify(scAfter), 'sentence count per paragraph invariant');

  const tplAllow: SurfaceExpressionTemplateAllowlistEntry[] = [
    {
      exception_id: 'TE-0001',
      surface: '*',
      match: { kind: 'whole_sentence', value: 'template stays.' },
      replacement: 'template KEPT.',
    },
  ];
  const out2 = applySurfaceExpressionRulesWithTables([sec], opts, { rules: [], templateAllowlist: tplAllow });
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
  const glueRules: SurfaceExpressionRule[] = [
    {
      rule_id: 'expr-glue',
      surfaces: ['*'],
      provenances: ['assembler_glue'],
      match: { kind: 'prefix', before_prefix: 'ZZZ', after_prefix: 'AAA' },
      replacement: '',
    },
  ];
  const outGlue = applySurfaceExpressionRulesWithTables([syntheticSection(glueTagged)], opts, {
    rules: glueRules,
    templateAllowlist: [],
  });
  assert(outGlue[0]!.text.trim() === glueAfter.trim(), 'prefix glue substitution');
  assertSectionTaggedInvariant(outGlue[0]!, 'glue');

  const feedOpts: ProjectionOptions = { surface: 'feed', tier: 'baseline', narrativePlan: null };
  const feedRules: SurfaceExpressionRule[] = [
    {
      rule_id: 'expr-feed-long',
      surfaces: ['feed'],
      provenances: ['synthesis_wrapper'],
      match: { kind: 'whole_sentence', before: 'short.' },
      replacement: 'this is far too long to apply on feed.',
    },
    {
      rule_id: 'expr-feed-ok',
      surfaces: ['feed'],
      provenances: ['synthesis_wrapper'],
      match: { kind: 'whole_sentence', before: 'short.' },
      replacement: 'tiny.',
    },
  ];
  const feedTagged: TaggedSectionBody = {
    paragraphs: [{ sentences: [{ text: 'short.', provenance: 'synthesis_wrapper' }] }],
  };
  const outFeed = applySurfaceExpressionRulesWithTables([syntheticSection(feedTagged)], feedOpts, {
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
  const emptyPass = applySurfaceExpressionRulesWithTables(projected, projOpts, { rules: [], templateAllowlist: [] });
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

/** Shipped projection expression tables and RPG line tables: wave caps, glue load, feed length, preface, history. */
function wave1ShippedTablesVerification(): void {
  const wave2a = SHIPPED_SURFACE_EXPRESSION_RULES.filter((r) => r.rule_id.includes('-W2-'));
  const wave2b = PHASE5B_RULES.filter((r) => r.rule_id.includes('-W2-'));
  assert(wave2a.length === 14, `expected 14 shipped -W2- projection expression rules, got ${wave2a.length}`);
  assert(wave2b.length === 10, `expected 10 Wave 2 Phase5B rules, got ${wave2b.length}`);
  assert(wave2a.length + wave2b.length <= 28, 'Wave 2 new rule rows must stay within the 28-row cap (5A+5B)');

  const wave3a = SHIPPED_SURFACE_EXPRESSION_RULES.filter((r) => r.rule_id.includes('-W3-'));
  const wave3b = PHASE5B_RULES.filter((r) => r.rule_id.includes('-W3-'));
  assert(wave3a.length === 14, `expected 14 shipped -W3- projection expression rules, got ${wave3a.length}`);
  assert(wave3b.length === 4, `expected 4 Wave 3 Phase5B rules, got ${wave3b.length}`);
  assert(wave3a.length + wave3b.length <= 22, 'Wave 3 new rule rows must stay within the 22-row cap (5A+5B)');

  const waveTotal =
    SHIPPED_SURFACE_EXPRESSION_RULES.length + SHIPPED_SURFACE_EXPRESSION_TEMPLATE_ALLOWLIST.length + PHASE5B_RULES.length;
  assert(waveTotal <= 80, `cumulative shipped expression + RPG line rows ${waveTotal} must stay bounded`);

  const wave6b = SHIPPED_SURFACE_EXPRESSION_RULES.filter((r) => r.rule_id.startsWith('P6B-'));
  assert(
    wave6b.length <= 18,
    `aggregate P6B- family rule cap: expected at most 18 rules, got ${wave6b.length}`
  );
  assert(wave6b.length === 3, `expected 3 shipped P6B- projection expression rules, got ${wave6b.length}`);

  for (const ex of SHIPPED_SURFACE_EXPRESSION_TEMPLATE_ALLOWLIST) {
    if (ex.match.kind === 'whole_sentence') {
      assert(
        ex.replacement.length <= ex.match.value.length,
        `feed allowlist ${ex.exception_id}: replacement must be <= original (${ex.replacement.length} vs ${ex.match.value.length})`
      );
    }
  }

  const glueRules = SHIPPED_SURFACE_EXPRESSION_RULES.filter((r) => r.match.kind === 'prefix');
  assert(glueRules.length === 6, `expected 6 prefix glue rules (profile + group + Wave 2/3 surfaces), got ${glueRules.length}`);
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
    { rule_id: 'P5A-W3-001-glue-overlay-baseline-prefix', full: 'In this chart, you see a baseline personal picture.' },
    { rule_id: 'P6B-001-glue-group-baseline-prefix', full: 'Here, you see a baseline framing.' },
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

  const histSupportBefore =
    'It also echoes a recent pattern of bringing in connection or perspective.';
  const histSupportOut = applyPhase5BWholeTextWithTables('rpg_continuity_lines_v1', histSupportBefore, {
    rules: PHASE5B_RULES,
  });
  assert(histSupportOut !== histSupportBefore, 'Wave 3 history support_connect mutates when matched');

  const groupPrefaceTagged: TaggedSectionBody = {
    paragraphs: [
      {
        sentences: [
          {
            text: 'This group holds multiple voices; emphasis may spread unevenly.',
            provenance: 'preface',
          },
        ],
      },
    ],
  };
  const groupPrefOut = applySurfaceExpressionRulesWithTables([syntheticSection(groupPrefaceTagged)], {
    surface: 'group',
    tier: 'baseline',
    narrativePlan: null,
    participantCount: 4,
  }, {
    rules: SHIPPED_SURFACE_EXPRESSION_RULES,
    templateAllowlist: SHIPPED_SURFACE_EXPRESSION_TEMPLATE_ALLOWLIST,
  });
  assert(groupPrefOut[0]!.text.includes('room-wide'), 'Wave 3 group ensemble preface rule applies');

  for (const r of SHIPPED_SURFACE_EXPRESSION_RULES) {
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
  const prefaceOut = applySurfaceExpressionRulesWithTables([syntheticSection(prefaceObsTagged)], prefaceOpts, {
    rules: SHIPPED_SURFACE_EXPRESSION_RULES,
    templateAllowlist: SHIPPED_SURFACE_EXPRESSION_TEMPLATE_ALLOWLIST,
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
  const situOut = applySurfaceExpressionRulesWithTables([syntheticSection(situTagged)], situLoversOpts, {
    rules: SHIPPED_SURFACE_EXPRESSION_RULES,
    templateAllowlist: SHIPPED_SURFACE_EXPRESSION_TEMPLATE_ALLOWLIST,
  });
  assert(situOut[0]!.text.includes('in the moment'), 'situational preface rule applies for lovers');

  const situRivalsOpts: ProjectionOptions = { ...prefaceOpts, connectionMode: 'rivals' };
  const situRivalsOut = applySurfaceExpressionRulesWithTables([syntheticSection(situTagged)], situRivalsOpts, {
    rules: SHIPPED_SURFACE_EXPRESSION_RULES,
    templateAllowlist: SHIPPED_SURFACE_EXPRESSION_TEMPLATE_ALLOWLIST,
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
    applySurfaceExpressionRules(
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
    applySurfaceExpressionRules(
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

  const campSyn = applySurfaceExpressionRules(
    projectTextFromSemanticCore(core, 'camp-syn', { phaseD: true, surface: 'campaign', tier: 'expanded', narrativePlan: null }),
    { surface: 'campaign', tier: 'expanded', narrativePlan: null }
  )
    .map((s) => s.text)
    .join('\n');
  assert(
    campSyn.includes('without overwriting it') ||
      campSyn.includes('read as situational') ||
      campSyn.includes('clearer pacing') ||
      campSyn.includes('tighter pacing') ||
      campSyn.includes('lands most clearly') ||
      campSyn.includes('The feel is often situational when life load shifts week to week.') ||
      campSyn.includes('In this pass,') ||
      campSyn.includes('tradeoff in this pass'),
    'Wave 2–3 campaign-only synthesis rules apply when literals present'
  );

  const profExt = applySurfaceExpressionRules(
    projectTextFromSemanticCore(core, 'w3-trait', { phaseD: true, surface: 'profile', tier: 'expanded', narrativePlan: null }),
    { surface: 'profile', tier: 'expanded', narrativePlan: null }
  );
  const traitJoined = profExt.map((s) => s.text).join('\n');
  if (traitJoined.includes('Trait bridge:')) {
    assert(
      traitJoined.includes('without forcing one story') || traitJoined.includes('read as situational'),
      'Wave 3 profile trait_bridge voice applies when section present'
    );
  }

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
  const prof2 = applySurfaceExpressionRules(prof, profOpts);
  assert(JSON.stringify(prof) === JSON.stringify(prof2), 'applySurfaceExpressionRules idempotent on shipped rules');

  surfaceExpressionClaimBodyAndVoiceInvariants(core);

  phase6bAggregateExpressionInvariants();
}

/**
 * **Proj:** aggregate expression wave invariants (legacy “Phase 6B”; `P6B-` rule_id family) —
 * aggregate redundancy, pair vs group clarity, determinism, tagged reconstruction (substring checks only).
 */
function phase6bAggregateExpressionInvariants(): void {
  const p6Snap = (d: number): EphemerisSnapshot => ({
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128 + d,
    lon: -74.006 + d,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 + d },
      { name: 'Moon', lon: 45 + d },
      { name: 'Mercury', lon: 60 + d },
      { name: 'Venus', lon: 75 + d },
      { name: 'Mars', lon: 90 + d },
      { name: 'Jupiter', lon: 105 + d },
      { name: 'Saturn', lon: 120 + d },
      { name: 'Uranus', lon: 135 + d },
      { name: 'Neptune', lon: 150 + d },
      { name: 'Pluto', lon: 165 + d },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  });
  const na = p6Snap(0);
  const nb = p6Snap(5);
  const nc = p6Snap(11);
  const fv = encodeFeatures(na) as FeatureVec;
  const fv2 = encodeFeatures(nb) as FeatureVec;
  const fv3 = encodeFeatures(nc) as FeatureVec;
  const g = guidanceFromFeatures(fv, na, 'p6b');
  const m12 = mergeFeatureVectors(fv, fv2, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 });
  const merged3 = mergeFeatureVectors(m12, fv3, { relationshipMode: 'neutral', wA: 0.67, wB: 0.33 });
  const coreGroup = interpretCanonicalReportObject(
    buildCanonicalReportForAggregate({
      kind: 'group',
      subject_ids: ['p6b'],
      participants: [
        { snapshot: na, featureVec: fv, role: 'primary' },
        { snapshot: nb, featureVec: fv2, role: 'member_i' },
        { snapshot: nc, featureVec: fv3, role: 'member_i' },
      ],
      composite: merged3 as FeatureVec,
      anchorIndex: 0,
      control_surface_hash: 'p6b',
      compose_seed: 'p6b',
      guidance: g,
      relationalWeather: null,
    })
  );
  const groupOpts: ProjectionOptions = {
    phaseD: true,
    surface: 'group',
    tier: 'extended',
    narrativePlan: null,
    participantCount: 3,
  };
  const g1 = applySurfaceExpressionRules(projectTextFromSemanticCore(coreGroup, 'p6b-g', groupOpts), groupOpts);
  const g2 = applySurfaceExpressionRules(projectTextFromSemanticCore(coreGroup, 'p6b-g', groupOpts), groupOpts);
  assert(JSON.stringify(g1) === JSON.stringify(g2), 'phase6b group aggregate projection deterministic');

  const prefaceJoined = g1.filter((s) => s.id === 'ensemble_framing').map((s) => s.text).join('\n');
  assert(prefaceJoined.includes('This group'), 'phase6b ensemble preface owns This group topology');

  for (const s of g1) {
    if (s.id !== 'ensemble_framing' && s.text.includes('This group')) {
      throw new Error(`[test-phase5-expression-filters] This group outside preface (${s.id})`);
    }
  }

  const thesisOutsideRel = g1
    .filter((s) => s.id !== 'relational_field')
    .map((s) => [s.text, ...(s.bullets ?? [])].join('\n'))
    .join('\n');
  const bannedThesis = ['not only one pair', 'zooming to one pair', 'one pair story'];
  for (const needle of bannedThesis) {
    assert(
      !thesisOutsideRel.includes(needle),
      `phase6b aggregate thesis phrase "${needle}" must stay in relational_field only`
    );
  }

  const rel = g1.find((x) => x.id === 'relational_field')?.text ?? '';
  assert(
    rel.length > 0 && (rel.includes('pair') || rel.includes('room') || rel.includes('dyad') || rel.includes('centers')),
    'phase6b relational_field retains aggregate thesis content'
  );

  const tierCarrier = g1.find((s) => s.id === 'signatures')?.text ?? '';
  assert(!tierCarrier.includes('Expanded group pass'), 'phase6b tier scaffold stays neutral (no group pass idiom)');
  assert(!tierCarrier.includes('Expanded pair pass'), 'phase6b tier scaffold stays neutral (no pair pass idiom)');
  assert(!tierCarrier.includes('people in the room'), 'phase6b tier scaffold has no room roster idiom');

  const glueCarrier = g1.find((s) => s.id === 'signatures')?.text ?? '';
  assert(!glueCarrier.includes('For this group'), 'phase6b glue stays neutral on group (no For this group)');

  for (const s of g1) assertSectionTaggedInvariant(s, 'phase6b-group');

  const coreCompat = interpretCanonicalReportObject(
    buildCanonicalReportForAggregate({
      kind: 'comparison',
      subject_ids: ['p6bc'],
      participants: [
        { snapshot: na, featureVec: fv, role: 'primary' },
        { snapshot: nb, featureVec: fv2, role: 'member_i' },
      ],
      composite: m12 as FeatureVec,
      anchorIndex: 0,
      control_surface_hash: 'p6bc',
      compose_seed: 'p6bc',
      guidance: g,
      relationalWeather: null,
    })
  );
  const compatOpts: ProjectionOptions = {
    phaseD: true,
    surface: 'compat_pair',
    tier: 'expanded',
    narrativePlan: null,
    connectionMode: 'friends',
  };
  const c1 = applySurfaceExpressionRules(projectTextFromSemanticCore(coreCompat, 'p6b-c', compatOpts), compatOpts);
  const pre = c1.find((x) => x.id === 'connection_structure')?.text ?? '';
  assert(pre.includes('This connection'), 'phase6b compat preface uses connection topology');
  assert(!pre.includes('This group'), 'phase6b compat preface does not use group topology');
  const glueC = c1.find((s) => s.id === 'signatures')?.text ?? '';
  assert(glueC.includes('For this connection'), 'phase6b compat glue names connection');
  const joinedC = c1.map((s) => s.text).join('\n');
  assert(!joinedC.includes('This group'), 'phase6b compat output has no group topology phrase');

  for (const s of c1) assertSectionTaggedInvariant(s, 'phase6b-compat');
}

main();
