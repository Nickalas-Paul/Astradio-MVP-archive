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
import { applyPhase5AExpressionWithTables, type Phase5AEngineTables } from '../projection/rule-layer/phase5a-engine';
import type { Phase5ARule, Phase5ATemplateAllowlistEntry } from '../projection/rule-layer/phase5a-tables';
import { applyPhase5BLineArrayWithTables, applyPhase5BWholeTextWithTables } from '../rpg/phase5b-engine';
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
  assert(JSON.stringify(projected) === JSON.stringify(emptyPass), 'empty shipped tables: projection identity');
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

  console.log('[test-phase5-expression-filters] OK');
}

main();
