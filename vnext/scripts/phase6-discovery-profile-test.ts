import assert from 'node:assert/strict';
import { buildCompatibilityExplanationProfile } from '../compatibility/discovery-explanation';
import { bucketIntentFit, canonicalIntentRank } from '../compatibility/intent-rank';
import type {
  CanonicalRelationalFieldObject,
  CompatibilityClassification,
  RelationalFieldScoreContract,
} from '../compatibility/contracts';
import type { RelationalIntent } from '../compatibility/relational-intent';

function fixture(scoringOverride?: Partial<RelationalFieldScoreContract['derived_indices']>): {
  field: CanonicalRelationalFieldObject;
  scoring: RelationalFieldScoreContract;
  classification: CompatibilityClassification;
} {
  const field: CanonicalRelationalFieldObject = {
    schema_version: 'canonical_relational_field_v1',
    surface_kind: 'compatibility_field',
    entity_ordering_rule_id: 'stable',
    entities: [
      { slot_index: 0, chart_id: 'a', natal_snapshot_hash: 'snap-a', feature_vector_hash: 'vec-a' },
      { slot_index: 1, chart_id: 'b', natal_snapshot_hash: 'snap-b', feature_vector_hash: 'vec-b' },
    ],
    pairwise_matrix: [
      {
        pair_key: '0:1',
        a_slot_index: 0,
        b_slot_index: 1,
        vector_hash_a: 'vec-a',
        vector_hash_b: 'vec-b',
        interaction_vector: {
          resonance: 0.78,
          friction: 0.24,
          volatility: 0.31,
          complementarity: 0.7,
          asymmetry: 0.3,
          persistence: 0.8,
        },
        category_weights: {
          reinforcing: 0.73,
          cross_pressuring: 0.22,
          escalating: 0.15,
          dissolving: 0.1,
          transforming: 0.42,
        },
        dominant_category: 'reinforcing',
        provenance: { encoder_version_a: 'v1', encoder_version_b: 'v1', algorithm_version: 'v1' },
      },
    ],
    trait_interaction_graph: [
      {
        edge_key: '0:discipline->1:coordination:reinforcing',
        source_slot_index: 0,
        target_slot_index: 1,
        trait_id_source: 'discipline',
        trait_id_target: 'coordination',
        interaction_category: 'reinforcing',
        weight: 0.67,
        contributing_pair_key: '0:1',
        contributing_signal_count: 2,
        provenance: { derivation_code: 'test', algorithm_version: 'v1' },
      },
    ],
    domain_house_interactions: [
      {
        interaction_key: '0:1:career:10:6:reinforcing',
        pair_key: '0:1',
        source_slot_index: 0,
        target_slot_index: 1,
        domain_id: 'career',
        source_house: 10,
        target_house: 6,
        interaction_category: 'reinforcing',
        weight: 0.64,
      },
    ],
    domain_distribution: [{ domain_id: 'career', total_weight: 0.64, contributing_edges: 1 }],
    composite_feature_vector_hash: null,
    field_algorithm_id: 'compatibility_field_v1',
    field_algorithm_version: 'compatibility_field_v1',
    object_identity_hash: 'field-lock-abc-123',
    created_from: {
      chart_ids_ordered: ['a', 'b'],
      vector_hashes: { a: 'vec-a', b: 'vec-b' },
      snapshot_hashes: { a: 'snap-a', b: 'snap-b' },
      encoder_versions: { a: 'v1', b: 'v1' },
    },
    activation_overlay: null,
  };
  const scoring: RelationalFieldScoreContract = {
    schema_version: 'relational_field_score_v1',
    compatibility_field_hash: field.object_identity_hash,
    scoring_algorithm_id: 'compatibility_scoring',
    scoring_algorithm_version: 'relational_field_score_v1',
    entity_count: 2,
    vector_hashes: { a: 'vec-a', b: 'vec-b' },
    relational_weather_state_hash: null,
    components: {
      pairwise_resonance_mean: 0.78,
      pairwise_friction_mean: 0.24,
      pairwise_volatility_mean: 0.31,
      pairwise_complementarity_mean: 0.7,
      trait_graph_density: 0.5,
      reinforcing_weight: 0.73,
      cross_pressuring_weight: 0.22,
      escalating_weight: 0.15,
      dissolving_weight: 0.1,
      transforming_weight: 0.42,
      domain_distribution_entropy: 0.2,
      activation_pressure: null,
    },
    derived_indices: {
      cohesion_index: 0.76,
      tension_index: 0.28,
      transformation_index: 0.41,
      stability_index: 0.7,
      ...scoringOverride,
    },
    scalar_outputs: {
      overall_relational_intensity: 0.48,
    },
    provenance: {
      field_algorithm_version: 'compatibility_field_v1',
      encoder_versions: { a: 'v1', b: 'v1' },
    },
  };
  const classification: CompatibilityClassification = {
    classification_id: 'cohesive_field:field-lock',
    classification_version: 'compatibility_classification_v1',
    compatibility_field_hash: field.object_identity_hash,
    scoring_contract_version: scoring.schema_version,
    scoring_algorithm_version: scoring.scoring_algorithm_version,
    inputs: {
      cohesion_index: scoring.derived_indices.cohesion_index,
      tension_index: scoring.derived_indices.tension_index,
      transformation_index: scoring.derived_indices.transformation_index,
      stability_index: scoring.derived_indices.stability_index,
      overall_relational_intensity: scoring.scalar_outputs.overall_relational_intensity,
    },
    outputs: {
      class_code: 'cohesive_field',
      class_rank: 1,
    },
  };
  return { field, scoring, classification };
}

function profile(intent: RelationalIntent, o?: Partial<RelationalFieldScoreContract['derived_indices']>) {
  const fx = fixture(o);
  return buildCompatibilityExplanationProfile({
    field: fx.field,
    scoring: fx.scoring,
    classification: fx.classification,
    intent,
  });
}

function assertAnchorsTyped(anchors: string[]): void {
  for (const a of anchors) {
    assert.match(a, /^(index:[a-z_]+|pair:[^:]+:[^:]+:[a-z_]+|trait:.+|domain:[a-z_]+|class:[a-z_]+)$/);
  }
}

function run(): void {
  const friend = profile('friend');
  assert.equal(friend.primarySupports.length, 2);
  assert.ok(friend.primarySupports[0].startsWith('Index signal'));
  assert.ok(friend.primarySupports[1].startsWith('Interaction signal'));
  assert.ok(friend.secondarySupports.length >= 1);
  assert.ok(friend.tensionsOrLimits.length >= 1);
  assert.ok(friend.intentFitSummary.startsWith('Friend: '));
  assert.ok(friend.intentFitSummary.includes('Rival:') || friend.intentFitSummary.includes('Lover:') || friend.intentFitSummary.includes('Collaborator:'));
  assert.deepEqual(Object.keys(friend.contrastByIntent), ['friend', 'lover', 'collaborator', 'rival']);
  assertAnchorsTyped(friend.anchors);

  const sparseFx = fixture();
  sparseFx.field.trait_interaction_graph = [];
  sparseFx.field.domain_distribution = [];
  const sparse = buildCompatibilityExplanationProfile({
    field: sparseFx.field,
    scoring: sparseFx.scoring,
    classification: sparseFx.classification,
    intent: 'friend',
  });
  assert.ok(sparse.secondarySupports.includes('Limited structural signals available in this field'));

  const rival = profile('rival');
  assert.notDeepEqual(friend.primarySupports, rival.primarySupports);

  const repeat1 = profile('collaborator');
  const repeat2 = profile('collaborator');
  assert.deepEqual(repeat1, repeat2);

  const lowFriction = profile('friend', { tension_index: 0.1, transformation_index: 0.2 });
  assert.ok(lowFriction.tensionsOrLimits.length >= 1);

  const scores = ['friend', 'lover', 'collaborator', 'rival'].map((intent) =>
    bucketIntentFit(canonicalIntentRank(fixture().scoring, intent as RelationalIntent))
  );
  assert.equal(scores.length, 4);
}

run();
console.log('[phase6] discovery profile tests passed');
