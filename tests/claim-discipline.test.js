/**
 * Claim discipline: reinforcement tiers and deterministic ordering.
 * Run: npm run vnext:build && node --test tests/claim-discipline.test.js
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { reinforcementTier, sortClaimsDeterministic } = require('../dist/vnext/vnext/projection/rule-layer/claim-discipline.js');
const { mechanismSignalGroupKey } = require('../dist/vnext/vnext/projection/rule-layer/dominant-signal-selection.js');

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

test('Tier 1: same mechanismSignalGroupKey as dominant', () => {
  const a = {
    claim_id: 'MODALITY_CARDINAL',
    priority_rank: 0,
    strength: 0.5,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
  };
  const b = {
    claim_id: 'MODALITY_FIXED',
    priority_rank: 1,
    strength: 0.9,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
  };
  const core = hollowCore([a, b]);
  assert.equal(mechanismSignalGroupKey(a), mechanismSignalGroupKey(b));
  assert.equal(reinforcementTier(a, [b], core), 1);
});

test('Tier 4 before drift: slot + derivation match when family differs', () => {
  const d = {
    claim_id: 'ELEMENT_FIRE_DOM',
    priority_rank: 0,
    strength: 1,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  };
  const c = {
    claim_id: 'ELEMENT_EARTH_DOM',
    priority_rank: 1,
    strength: 0.4,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  };
  const core = hollowCore([d, c]);
  assert.equal(reinforcementTier(c, [d], core), 4);
});

test('Tier 3: undirected edge to dominant', () => {
  const d = {
    claim_id: 'ELEMENT_FIRE_DOM',
    priority_rank: 0,
    strength: 1,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  };
  const c = {
    claim_id: 'TONAL_BRIGHT',
    priority_rank: 1,
    strength: 0.5,
    polarity: 'neutral',
    participant_slot_indices: [9],
    derivation_code: 'DERIVE_BRIGHTNESS_INDEX',
  };
  const base = hollowCore([d, c]);
  const core = {
    ...base,
    tension_harmony: {
      tension_band: 'TENSION_BAND_MED',
      harmony_band: 'REL_HARMONY_MED',
      claim_edges: [{ from_claim_id: c.claim_id, to_claim_id: d.claim_id, edge_kind: 'amplifies' }],
    },
  };
  assert.equal(reinforcementTier(c, [d], core), 3);
});

test('Drift when no tier matches', () => {
  const d = {
    claim_id: 'ELEMENT_FIRE_DOM',
    priority_rank: 0,
    strength: 1,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  };
  const c = {
    claim_id: 'TONAL_BRIGHT',
    priority_rank: 1,
    strength: 0.5,
    polarity: 'neutral',
    participant_slot_indices: [1],
    derivation_code: 'DERIVE_BRIGHTNESS_INDEX',
  };
  const core = hollowCore([d, c]);
  assert.equal(reinforcementTier(c, [d], core), null);
});

test('sortClaimsDeterministic: strength desc, priority_rank asc, claim_id asc', () => {
  const x = {
    claim_id: 'Z',
    priority_rank: 1,
    strength: 0.5,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'D1',
  };
  const y = {
    claim_id: 'A',
    priority_rank: 0,
    strength: 0.9,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'D1',
  };
  const z = {
    claim_id: 'M',
    priority_rank: 2,
    strength: 0.9,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'D1',
  };
  const sorted = sortClaimsDeterministic([x, y, z]);
  assert.deepEqual(sorted.map((c) => c.claim_id), ['A', 'M', 'Z']);
  const sorted2 = sortClaimsDeterministic([z, x, y]);
  assert.deepEqual(sorted.map((c) => c.claim_id), sorted2.map((c) => c.claim_id));
});
