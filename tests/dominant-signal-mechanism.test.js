/**
 * Dominant mechanism-signal selection and controlled `mep` consumption.
 * Run: npm run vnext:build && node --test tests/dominant-signal-mechanism.test.js
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  mechanismGroupPartitionKey,
  mechanismSignalGroupKey,
  selectDominantMechanismSignals,
  compareClaimsForDominance,
  dominantMechanismKForTier,
} = require('../dist/vnext/vnext/projection/rule-layer/dominant-signal-selection.js');
const { claimMechanismRelatedToDominants } = require('../dist/vnext/vnext/projection/rule-layer/dominant-signal-relatedness.js');
const {
  buildClaimMechanismExpressionParagraph,
  buildControlledMechanismExpressionParagraph,
  renderClaimExpressionBlock,
  renderMechanismArcBlock,
} = require('../dist/vnext/vnext/projection/rule-layer/claim-synthesize.js');

/** @returns {import('../dist/vnext/vnext/semantic/semantic-core').SemanticCore} */
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
    text: { section_eligibility: [], emphasis_order: [], forbidden_tone_flags: [] },
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

test('polarity-aware grouping: same family different polarity => different partition keys', () => {
  const a = {
    claim_id: 'TENSION_BAND_HIGH',
    priority_rank: 0,
    strength: 0.9,
    polarity: 'challenging',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_TENSION',
  };
  const b = {
    claim_id: 'TENSION_BAND_LOW',
    priority_rank: 1,
    strength: 0.2,
    polarity: 'constructive',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_TENSION',
  };
  assert.equal(mechanismSignalGroupKey(a), mechanismSignalGroupKey(b)); // same derivation|family
  assert.notEqual(mechanismGroupPartitionKey(a), mechanismGroupPartitionKey(b)); // polarity splits groups
});

test('at most one dominant per mechanism group (modality family)', () => {
  const slice = [
    {
      claim_id: 'MODALITY_CARDINAL',
      priority_rank: 0,
      strength: 0.2,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
    {
      claim_id: 'MODALITY_FIXED',
      priority_rank: 1,
      strength: 0.9,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
    {
      claim_id: 'MODALITY_MUTABLE',
      priority_rank: 2,
      strength: 0.5,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
  ];
  const dom = selectDominantMechanismSignals(slice, 'expanded');
  assert.equal(dom.filter((id) => id.startsWith('MODALITY')).length, 1);
  assert.equal(dom[0], 'MODALITY_FIXED');
});

test('deterministic scoring and tie-break: higher strength wins; tie uses claim_id', () => {
  const a = {
    claim_id: 'TONAL_BRIGHT',
    priority_rank: 0,
    strength: 0.5,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_BRIGHTNESS_INDEX',
  };
  const b = {
    claim_id: 'TONAL_DARK',
    priority_rank: 1,
    strength: 0.5,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_BRIGHTNESS_INDEX',
  };
  assert(compareClaimsForDominance(a, b) < 0); // TONAL_BRIGHT lexicographically before TONAL_DARK when equal strength
  const slice = [b, a];
  const dom = selectDominantMechanismSignals(slice, 'baseline');
  assert.deepEqual(dom, ['TONAL_BRIGHT']);
});

test('locked K: baseline 2, expanded 3 when enough groups', () => {
  assert.equal(dominantMechanismKForTier('baseline'), 2);
  assert.equal(dominantMechanismKForTier('expanded'), 3);
  assert.equal(dominantMechanismKForTier('extended'), 3);
  const slice = [
    {
      claim_id: 'ELEMENT_FIRE_DOM',
      priority_rank: 0,
      strength: 0.9,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
    },
    {
      claim_id: 'ELEMENT_EARTH_DOM',
      priority_rank: 1,
      strength: 0.8,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
    },
    {
      claim_id: 'MODALITY_CARDINAL',
      priority_rank: 2,
      strength: 0.7,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
    {
      claim_id: 'TONAL_BRIGHT',
      priority_rank: 3,
      strength: 0.1,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_BRIGHTNESS_INDEX',
    },
  ];
  const b = selectDominantMechanismSignals(slice, 'baseline');
  assert.equal(b.length, 2);
  const e = selectDominantMechanismSignals(slice, 'expanded');
  assert.equal(e.length, 3);
});

test('controlled mep: tail is Tier 1–2 only; no unrelated third pass', () => {
  const dominant = {
    claim_id: 'ELEMENT_FIRE_DOM',
    priority_rank: 0,
    strength: 1,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  };
  const unrelatedEarly = {
    claim_id: 'TONAL_BRIGHT',
    priority_rank: 1,
    strength: 0.5,
    polarity: 'neutral',
    participant_slot_indices: [1],
    derivation_code: 'DERIVE_BRIGHTNESS_INDEX',
  };
  const relatedLate = {
    claim_id: 'ELEMENT_EARTH_DOM',
    priority_rank: 2,
    strength: 0.4,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  };
  const core = hollowCore([dominant, unrelatedEarly, relatedLate]);
  const domIds = ['ELEMENT_FIRE_DOM'];
  const mep = buildControlledMechanismExpressionParagraph(
    core,
    'seed',
    'baseline',
    'profile',
    [],
    [],
    domIds
  );
  assert.deepEqual(mep.claimIds, ['ELEMENT_FIRE_DOM']);
  assert.ok(!mep.claimIds.includes('TONAL_BRIGHT'));
  assert.ok(!mep.claimIds.includes('ELEMENT_EARTH_DOM'));
});

test('stable localIndex: rendering uses slice index not visit order', () => {
  const slice = [
    {
      claim_id: 'MODALITY_CARDINAL',
      priority_rank: 0,
      strength: 0.5,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
    {
      claim_id: 'ELEMENT_FIRE_DOM',
      priority_rank: 1,
      strength: 0.99,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
    },
  ];
  const core = hollowCore(slice);
  const domIds = selectDominantMechanismSignals(slice, 'baseline');
  assert.deepEqual(domIds, ['ELEMENT_FIRE_DOM', 'MODALITY_CARDINAL']);
  const d1 = [];
  const p1 = [];
  const d2 = [];
  const p2 = [];
  const expectedFirstArc = renderMechanismArcBlock({
    claim: slice[1],
    index: 0,
    n: 2,
    sectionRoleDeque: d1,
    paragraphNormDeque: p1,
    seed: 'seed|ELEMENT_FIRE_DOM|mep',
  });
  const mep = buildControlledMechanismExpressionParagraph(
    core,
    'seed',
    'baseline',
    'profile',
    d2,
    p2,
    domIds
  );
  assert.ok(mep.text.startsWith(expectedFirstArc.text));
  const block = renderClaimExpressionBlock({
    claim: slice[1],
    localIndex: 1,
    seed: 'seed|ELEMENT_FIRE_DOM|mep',
    surface: 'profile',
    tier: 'baseline',
    sectionRoleDeque: [],
    paragraphNormDeque: [],
  });
  assert.ok(block.text.length > 0, 'renderClaimExpressionBlock still emits body');
});

test('flag-off parity: legacy mep equals controlled with empty dominant list', () => {
  const slice = [
    {
      claim_id: 'MODALITY_CARDINAL',
      priority_rank: 0,
      strength: 0.5,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
    {
      claim_id: 'ELEMENT_FIRE_DOM',
      priority_rank: 1,
      strength: 0.9,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
    },
  ];
  const core = hollowCore(slice);
  const a = buildClaimMechanismExpressionParagraph(core, 's', 'baseline', 'profile', [], []);
  const b = buildControlledMechanismExpressionParagraph(core, 's', 'baseline', 'profile', [], [], []);
  assert.equal(a.text, b.text);
  assert.deepEqual(a.claimIds, b.claimIds);
});

test('flag-on dominant prefix: first mep ids match dominant order not slice order', () => {
  const slice = [
    {
      claim_id: 'MODALITY_CARDINAL',
      priority_rank: 0,
      strength: 0.5,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
    {
      claim_id: 'ELEMENT_FIRE_DOM',
      priority_rank: 1,
      strength: 0.99,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
    },
    {
      claim_id: 'ELEMENT_EARTH_DOM',
      priority_rank: 2,
      strength: 0.01,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
    },
  ];
  const core = hollowCore(slice);
  const dom = selectDominantMechanismSignals(slice, 'baseline');
  const mep = buildControlledMechanismExpressionParagraph(core, 's', 'baseline', 'profile', [], [], dom);
  assert.deepEqual(mep.claimIds.slice(0, 2), dom);
  assert.notDeepEqual(mep.claimIds.slice(0, 2), ['MODALITY_CARDINAL', 'ELEMENT_FIRE_DOM']);
});

test('determinism: repeated selection and mep', () => {
  const slice = [
    {
      claim_id: 'RESOLUTION_STRONG',
      priority_rank: 0,
      strength: 0.4,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_RESOLUTION_INDEX',
    },
    {
      claim_id: 'RESOLUTION_SOFT',
      priority_rank: 1,
      strength: 0.6,
      polarity: 'neutral',
      participant_slot_indices: [0],
      derivation_code: 'DERIVE_RESOLUTION_INDEX',
    },
  ];
  const core = hollowCore(slice);
  const dom1 = selectDominantMechanismSignals(slice, 'baseline');
  const dom2 = selectDominantMechanismSignals(slice, 'baseline');
  assert.deepEqual(dom1, dom2);
  const m1 = buildControlledMechanismExpressionParagraph(core, 'x', 'baseline', 'profile', [], [], dom1);
  const m2 = buildControlledMechanismExpressionParagraph(core, 'x', 'baseline', 'profile', [], [], dom2);
  assert.equal(m1.text, m2.text);
});

test('claimMechanismRelatedToDominants uses partition and slots', () => {
  const d = {
    claim_id: 'ELEMENT_FIRE_DOM',
    priority_rank: 0,
    strength: 1,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  };
  const sameSlots = {
    claim_id: 'TONAL_BRIGHT',
    priority_rank: 1,
    strength: 0.5,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_BRIGHTNESS_INDEX',
  };
  const diffSlots = {
    claim_id: 'TONAL_DARK',
    priority_rank: 2,
    strength: 0.5,
    polarity: 'neutral',
    participant_slot_indices: [1],
    derivation_code: 'DERIVE_BRIGHTNESS_INDEX',
  };
  const core = hollowCore([d, sameSlots, diffSlots]);
  assert.equal(claimMechanismRelatedToDominants(sameSlots, [d], core), true);
  assert.equal(claimMechanismRelatedToDominants(diffSlots, [d], core), false);
});
