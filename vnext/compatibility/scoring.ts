import type {
  CanonicalRelationalFieldObject,
  CompatibilityClassification,
  RelationalFieldScoreContract,
  RelationalInteractionCategory,
} from './contracts';
import {
  COMPATIBILITY_CLASSIFICATION_VERSION,
  COMPATIBILITY_SCORING_ALGORITHM_VERSION,
  COMPATIBILITY_SCORING_SCHEMA_VERSION,
} from './contracts';
import { clamp01, roundCompat } from './stable';

function mean(values: number[]): number {
  if (!values.length) return 0;
  return roundCompat(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function entropy(weights: number[]): number {
  const filtered = weights.filter((value) => value > 0);
  if (!filtered.length) return 0;
  const raw = filtered.reduce((sum, value) => sum - value * Math.log2(value), 0);
  const max = Math.log2(filtered.length || 1);
  return max > 0 ? clamp01(raw / max) : 0;
}

function categoryWeight(field: CanonicalRelationalFieldObject, category: RelationalInteractionCategory): number {
  return mean(field.pairwise_matrix.map((cell) => cell.category_weights[category] ?? 0));
}

export function scoreCompatibilityField(field: CanonicalRelationalFieldObject): RelationalFieldScoreContract {
  const pairwise_resonance_mean = mean(field.pairwise_matrix.map((cell) => cell.interaction_vector.resonance));
  const pairwise_friction_mean = mean(field.pairwise_matrix.map((cell) => cell.interaction_vector.friction));
  const pairwise_volatility_mean = mean(field.pairwise_matrix.map((cell) => cell.interaction_vector.volatility));
  const pairwise_complementarity_mean = mean(field.pairwise_matrix.map((cell) => cell.interaction_vector.complementarity));
  const reinforcing_weight = categoryWeight(field, 'reinforcing');
  const cross_pressuring_weight = categoryWeight(field, 'cross_pressuring');
  const escalating_weight = categoryWeight(field, 'escalating');
  const dissolving_weight = categoryWeight(field, 'dissolving');
  const transforming_weight = categoryWeight(field, 'transforming');
  const possibleEdges = Math.max(1, field.entities.length * Math.max(1, field.entities.length - 1));
  const trait_graph_density = clamp01(field.trait_interaction_graph.length / possibleEdges);
  const domain_distribution_entropy = entropy(field.domain_distribution.map((row) => row.total_weight));
  const activation_pressure = field.activation_overlay ? roundCompat(field.activation_overlay.activation_vector.intensity) : null;
  const cohesion_index = clamp01(
    pairwise_resonance_mean * 0.45 +
      pairwise_complementarity_mean * 0.2 +
      reinforcing_weight * 0.2 +
      (1 - pairwise_friction_mean) * 0.15
  );
  const tension_index = clamp01(
    pairwise_friction_mean * 0.45 +
      pairwise_volatility_mean * 0.25 +
      cross_pressuring_weight * 0.2 +
      escalating_weight * 0.1
  );
  const transformation_index = clamp01(
    transforming_weight * 0.45 +
      dissolving_weight * 0.15 +
      escalating_weight * 0.15 +
      trait_graph_density * 0.15 +
      (activation_pressure ?? 0) * 0.1
  );
  const stability_index = clamp01(
    cohesion_index * 0.35 +
      (1 - pairwise_volatility_mean) * 0.3 +
      reinforcing_weight * 0.15 +
      domain_distribution_entropy * 0.2
  );
  return {
    schema_version: COMPATIBILITY_SCORING_SCHEMA_VERSION,
    compatibility_field_hash: field.object_identity_hash,
    scoring_algorithm_id: 'compatibility_scoring',
    scoring_algorithm_version: COMPATIBILITY_SCORING_ALGORITHM_VERSION,
    entity_count: field.entities.length,
    vector_hashes: field.created_from.vector_hashes,
    relational_weather_state_hash: field.activation_overlay?.relational_weather_state_hash ?? null,
    components: {
      pairwise_resonance_mean,
      pairwise_friction_mean,
      pairwise_volatility_mean,
      pairwise_complementarity_mean,
      trait_graph_density,
      reinforcing_weight,
      cross_pressuring_weight,
      escalating_weight,
      dissolving_weight,
      transforming_weight,
      domain_distribution_entropy,
      activation_pressure,
    },
    derived_indices: {
      cohesion_index,
      tension_index,
      transformation_index,
      stability_index,
    },
    scalar_outputs: {
      overall_relational_intensity: clamp01((cohesion_index + tension_index + transformation_index) / 3),
    },
    provenance: {
      field_algorithm_version: field.field_algorithm_version,
      encoder_versions: field.created_from.encoder_versions,
    },
  };
}

export function classifyCompatibilityScore(score: RelationalFieldScoreContract): CompatibilityClassification {
  const inputs = {
    cohesion_index: score.derived_indices.cohesion_index,
    tension_index: score.derived_indices.tension_index,
    transformation_index: score.derived_indices.transformation_index,
    stability_index: score.derived_indices.stability_index,
    overall_relational_intensity: score.scalar_outputs.overall_relational_intensity,
  };
  let class_code = 'balanced_field';
  let class_rank = 2;
  if (inputs.transformation_index >= 0.7) {
    class_code = 'transformative_field';
    class_rank = 4;
  } else if (inputs.tension_index >= 0.68) {
    class_code = 'high_tension_field';
    class_rank = 3;
  } else if (inputs.cohesion_index >= 0.68 && inputs.stability_index >= 0.6) {
    class_code = 'cohesive_field';
    class_rank = 1;
  }
  return {
    classification_id: `${class_code}:${score.compatibility_field_hash.slice(0, 12)}`,
    classification_version: COMPATIBILITY_CLASSIFICATION_VERSION,
    compatibility_field_hash: score.compatibility_field_hash,
    scoring_contract_version: score.schema_version,
    scoring_algorithm_version: score.scoring_algorithm_version,
    inputs,
    outputs: {
      class_code,
      class_rank,
    },
  };
}
