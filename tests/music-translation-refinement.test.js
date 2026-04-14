/**
 * Music translation refinement: claim parity, listen arc, determinism.
 * Run: npm run vnext:build && node --test tests/music-translation-refinement.test.js
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildControlledMechanismExpressionParagraph,
  renderMechanismArcBlock,
  synthesizeClaimSentences,
} = require('../dist/vnext/vnext/projection/rule-layer/claim-synthesize.js');
const { assemblePhaseDSections } = require('../dist/vnext/vnext/projection/rule-layer/assemble-sections.js');
const { selectDominantMechanismSignals } = require('../dist/vnext/vnext/projection/rule-layer/dominant-signal-selection.js');
const { claimWindow } = require('../dist/vnext/vnext/projection/rule-layer/claim-select.js');

function hollowCore(claims) {
  return {
    provenance: {
      source_object_hash: 'test',
      authority_version: 'test',
      core_schema_version: 'semantic_core_v1',
      claim_index: {},
    },
    claims,
    relational: null,
    temporal: null,
    tension_harmony: null,
    text: {
      section_eligibility: ['SECTION_SIGNATURES', 'SECTION_SIGNIFICANCE', 'SECTION_MUSICAL'],
      emphasis_order: ['SECTION_SIGNATURES', 'SECTION_SIGNIFICANCE', 'SECTION_MUSICAL'],
      forbidden_tone_flags: [],
    },
    audio: {
      tempo_band: 'TEMPO_MED',
      density_band: 'DENSITY_BALANCED',
      arc_bias: 'ARC_CYCLIC',
      tension_bias: 'AUDIO_TENSION_MED',
      relational_texture: 'REL_TEXTURE_NEUTRAL',
    },
    campaign: null,
  };
}

test('mep and musical use same ordered claim ids and arc block count', () => {
  const claims = [
    {
      claim_id: 'ELEMENT_FIRE_DOM',
      priority_rank: 0,
      strength: 0.9,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_ELEMENT',
    },
    {
      claim_id: 'TONAL_BRIGHT',
      priority_rank: 1,
      strength: 0.8,
      polarity: 'neutral',
      derivation_code: 'DERIVE_ASTRO_SUMMARY_TONAL',
    },
  ];
  const core = hollowCore(claims);
  const seed = 'parity-seed';
  const mepRole = [];
  const mepNorm = [];
  const dom = ['ELEMENT_FIRE_DOM'];
  const mep = buildControlledMechanismExpressionParagraph(
    core,
    seed,
    'baseline',
    'profile',
    mepRole,
    mepNorm,
    dom
  );
  const ordered = [...mep.orderedClaims];
  assert.deepEqual(
    ordered.map((c) => c.claim_id),
    mep.claimIds,
    'orderedClaims and mep.claimIds must match order'
  );

  const listenRole = [];
  const listenNorm = [];
  const n = ordered.length;
  const listenLines = [];
  for (let i = 0; i < n; i++) {
    const b = renderMechanismArcBlock({
      claim: ordered[i],
      index: i,
      n,
      sectionRoleDeque: listenRole,
      paragraphNormDeque: listenNorm,
      seed: `${seed}|${ordered[i].claim_id}|listen`,
      register: 'listen',
    });
    listenLines.push(b.text);
  }
  const listenText = synthesizeClaimSentences(listenLines, mep.claimIds, `${seed}:mep`);
  assert.ok(listenText.length > 0);
  assert.ok(
    listenText.includes('In listening terms,') || listenText.includes('On replay,'),
    'listen register shims should appear when overrides absent'
  );
});

test('assemble: musical claimIdsReferenced equals mep.claimIds; no template timbre line', () => {
  const claims = [
    {
      claim_id: 'MODALITY_CARDINAL',
      priority_rank: 0,
      strength: 0.85,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
    {
      claim_id: 'TENSION_BAND_MED',
      priority_rank: 1,
      strength: 0.7,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_FEATURE_TENSION',
    },
    {
      claim_id: 'MOTION_LABEL_STEADY',
      priority_rank: 2,
      strength: 0.65,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_MOTION_LABEL',
    },
  ];
  const core = hollowCore(claims);
  const temporalBucket = 'static';
  const sections = assemblePhaseDSections({
    core,
    seed: 'asm-music',
    options: {
      surface: 'profile',
      tier: 'baseline',
      mechanismExpressionDominantSignals: true,
    },
    tierMetaRequested: 'baseline',
    tierEff: 'baseline',
    surface: 'profile',
    temporalBucket,
  });
  const mus = sections.find((s) => s.id === 'musical');
  assert.ok(mus, 'musical section present');

  const mechanismSlice = core.claims.slice(0, claimWindow('baseline'));
  const dominantIdsDiscipline = selectDominantMechanismSignals(mechanismSlice, 'baseline');
  const mepRole = [];
  const mepNorm = [];
  const mep = buildControlledMechanismExpressionParagraph(
    core,
    'asm-music',
    'baseline',
    'profile',
    mepRole,
    mepNorm,
    dominantIdsDiscipline
  );

  assert.deepEqual(mus.meta.claimIdsReferenced, mep.claimIds);
  assert.ok(!mus.text.includes(' as timbre'), 'no template timbre body');
  assert.ok(!mus.text.includes('Listen detail lives'), 'no LISTEN_POINTER template in body');
  assert.equal(mus.bullets, undefined);
});

test('determinism: two assembles produce identical musical text and claim ids', () => {
  const claims = [
    {
      claim_id: 'ELEMENT_AIR_DOM',
      priority_rank: 0,
      strength: 0.88,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_ELEMENT',
    },
    {
      claim_id: 'TONAL_DARK',
      priority_rank: 1,
      strength: 0.72,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_TONAL',
    },
  ];
  const core = hollowCore(claims);
  const params = {
    core,
    seed: 'det-seed',
    options: {
      surface: 'profile',
      tier: 'baseline',
      mechanismExpressionDominantSignals: true,
    },
    tierMetaRequested: 'baseline',
    tierEff: 'baseline',
    surface: 'profile',
    temporalBucket: 'static',
  };
  const a = assemblePhaseDSections(params).find((s) => s.id === 'musical');
  const b = assemblePhaseDSections(params).find((s) => s.id === 'musical');
  assert.equal(a.text, b.text);
  assert.deepEqual(a.meta.claimIdsReferenced, b.meta.claimIdsReferenced);
});
