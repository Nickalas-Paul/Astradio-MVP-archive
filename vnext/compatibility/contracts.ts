import type { DomainId } from '../campaign/phase1/contracts';

export const COMPATIBILITY_FIELD_SCHEMA_VERSION = 'canonical_relational_field_v1' as const;
export const COMPATIBILITY_SURFACE_KIND = 'compatibility_field' as const;
export const COMPATIBILITY_FIELD_ALGORITHM_ID = 'compatibility_field_v1' as const;
export const COMPATIBILITY_FIELD_ALGORITHM_VERSION = 'compatibility_field_v1' as const;
export const COMPATIBILITY_ACTIVATION_ALGORITHM_VERSION = 'compatibility_activation_v1' as const;
export const COMPATIBILITY_SCORING_SCHEMA_VERSION = 'relational_field_score_v1' as const;
export const COMPATIBILITY_SCORING_ALGORITHM_VERSION = 'relational_field_score_v1' as const;
export const COMPATIBILITY_CLASSIFICATION_VERSION = 'compatibility_classification_v1' as const;

export type PairKey = `${number}:${number}`;
export type TraitEdgeKey = `${number}:${string}->${number}:${string}:${RelationalInteractionCategory}`;

export type RelationalInteractionCategory =
  | 'reinforcing'
  | 'cross_pressuring'
  | 'escalating'
  | 'dissolving'
  | 'transforming';

export interface RelationalEntitySlot {
  slot_index: number;
  chart_id: string;
  natal_snapshot_hash: string;
  feature_vector_hash: string;
}

export interface PairwiseInteractionCell {
  pair_key: PairKey;
  a_slot_index: number;
  b_slot_index: number;
  vector_hash_a: string;
  vector_hash_b: string;
  interaction_vector: {
    resonance: number;
    friction: number;
    volatility: number;
    complementarity: number;
    asymmetry: number;
    persistence: number;
  };
  category_weights: Record<RelationalInteractionCategory, number>;
  dominant_category: RelationalInteractionCategory;
  provenance: {
    encoder_version_a: string;
    encoder_version_b: string;
    algorithm_version: string;
  };
}

export interface TraitInteractionEdge {
  edge_key: TraitEdgeKey;
  source_slot_index: number;
  target_slot_index: number;
  trait_id_source: string;
  trait_id_target: string;
  interaction_category: RelationalInteractionCategory;
  weight: number;
  contributing_pair_key: PairKey;
  contributing_signal_count: number;
  provenance: {
    derivation_code: string;
    algorithm_version: string;
  };
}

export interface DomainHouseInteraction {
  interaction_key: `${number}:${number}:${string}:${number}:${number}:${string}`;
  pair_key: PairKey;
  source_slot_index: number;
  target_slot_index: number;
  domain_id: DomainId;
  source_house: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  target_house: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  interaction_category: RelationalInteractionCategory;
  weight: number;
}

export interface DomainDistribution {
  domain_id: DomainId;
  total_weight: number;
  contributing_edges: number;
}

export interface RelationalActivationOverlay {
  activation_hash: string;
  base_field_hash: string;
  transit_lock: {
    ts: string;
    lat: number;
    lon: number;
    tz: string;
  };
  transit_snapshot_hash: string;
  relational_weather_state_hash: string | null;
  activation_vector: {
    harmony: number;
    friction: number;
    intensity: number;
    emotional_activation: number;
    communication_emphasis: number;
    volatility: number;
    growth_pressure: number;
  };
  activated_pair_keys: PairKey[];
  activated_trait_ids: string[];
  identity_modifier_ids: string[];
  mechanic_tags: string[];
  provenance: {
    algorithm_version: string;
    transit_input_version: string;
  };
}

export interface CanonicalRelationalFieldObject {
  schema_version: typeof COMPATIBILITY_FIELD_SCHEMA_VERSION;
  surface_kind: typeof COMPATIBILITY_SURFACE_KIND;
  entity_ordering_rule_id: string;
  entities: RelationalEntitySlot[];
  pairwise_matrix: PairwiseInteractionCell[];
  trait_interaction_graph: TraitInteractionEdge[];
  domain_house_interactions: DomainHouseInteraction[];
  domain_distribution: DomainDistribution[];
  composite_feature_vector_hash: string | null;
  field_algorithm_id: typeof COMPATIBILITY_FIELD_ALGORITHM_ID;
  field_algorithm_version: typeof COMPATIBILITY_FIELD_ALGORITHM_VERSION;
  object_identity_hash: string;
  created_from: {
    chart_ids_ordered: string[];
    vector_hashes: Record<string, string>;
    snapshot_hashes: Record<string, string>;
    encoder_versions: Record<string, string>;
  };
  activation_overlay: RelationalActivationOverlay | null;
}

export interface RelationalFieldScoreContract {
  schema_version: typeof COMPATIBILITY_SCORING_SCHEMA_VERSION;
  compatibility_field_hash: string;
  scoring_algorithm_id: 'compatibility_scoring';
  scoring_algorithm_version: typeof COMPATIBILITY_SCORING_ALGORITHM_VERSION;
  entity_count: number;
  vector_hashes: Record<string, string>;
  relational_weather_state_hash: string | null;
  components: {
    pairwise_resonance_mean: number;
    pairwise_friction_mean: number;
    pairwise_volatility_mean: number;
    pairwise_complementarity_mean: number;
    trait_graph_density: number;
    reinforcing_weight: number;
    cross_pressuring_weight: number;
    escalating_weight: number;
    dissolving_weight: number;
    transforming_weight: number;
    domain_distribution_entropy: number;
    activation_pressure: number | null;
  };
  derived_indices: {
    cohesion_index: number;
    tension_index: number;
    transformation_index: number;
    stability_index: number;
  };
  scalar_outputs: {
    overall_relational_intensity: number;
  };
  provenance: {
    field_algorithm_version: string;
    encoder_versions: Record<string, string>;
  };
}

export interface CompatibilityClassification {
  classification_id: string;
  classification_version: typeof COMPATIBILITY_CLASSIFICATION_VERSION;
  compatibility_field_hash: string;
  scoring_contract_version: typeof COMPATIBILITY_SCORING_SCHEMA_VERSION;
  scoring_algorithm_version: typeof COMPATIBILITY_SCORING_ALGORITHM_VERSION;
  inputs: {
    cohesion_index: number;
    tension_index: number;
    transformation_index: number;
    stability_index: number;
    overall_relational_intensity: number;
  };
  outputs: {
    class_code: string;
    class_rank: number;
  };
}

export interface PersistedCompatibilityRecord {
  compatibility_id: string;
  compatibility_field_hash: string;
  relationship_binding_id: string | null;
  chart_ids_ordered: string[];
  scoring_contract_version: typeof COMPATIBILITY_SCORING_SCHEMA_VERSION;
  scoring_algorithm_version: typeof COMPATIBILITY_SCORING_ALGORITHM_VERSION;
  classification_id: string | null;
  classification_version: string | null;
  vector_hashes: Record<string, string>;
  snapshot_hashes: Record<string, string>;
  encoder_versions: Record<string, string>;
  relational_weather_state_hash: string | null;
  transit_snapshot_hash: string | null;
  canonical_surface_kind: typeof COMPATIBILITY_SURFACE_KIND;
  created_at: string;
  computed_at: string;
}
