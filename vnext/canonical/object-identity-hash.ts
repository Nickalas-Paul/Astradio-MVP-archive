import crypto from 'crypto';
import type { CanonicalReportObject } from './canonical-report-object';
import { stableStringify } from './stable-json';

/**
 * H(canonical payload excluding object_identity_hash itself).
 */
export function computeCanonicalObjectIdentityHash(o: Omit<CanonicalReportObject, 'object_identity_hash'>): string {
  const payload = {
    schema_version: o.schema_version,
    surface_kind: o.surface_kind,
    subject_ids: [...o.subject_ids],
    ordering_rule_id: o.ordering_rule_id,
    participants: o.participants.map((p) => ({
      slot_role: p.slot_role,
      slot_index: p.slot_index,
      natal_snapshot_hash: p.natal_snapshot_hash,
      feature_vector_hash: p.feature_vector_hash,
      dominant_planet_names: [...p.dominant_planet_names],
    })),
    transit_lock: o.transit_lock,
    transit_snapshot_hash: o.transit_snapshot_hash,
    composite_algorithm_id: o.composite_algorithm_id,
    anchor_slot_index: o.anchor_slot_index,
    relational_weather_state_hash: o.relational_weather_state_hash,
    control_surface_hash: o.control_surface_hash,
    compose_seed: o.compose_seed,
    mechanical: o.mechanical,
    ml_stack_version: o.ml_stack_version,
    planner_version: o.planner_version,
    semantic_authority_version: o.semantic_authority_version,
    gate_policy_version: o.gate_policy_version,
    composite_feature_fingerprint: o.composite_feature_vector
      ? stableStringify(Array.from(o.composite_feature_vector))
      : null,
    pair_interaction_aspects_digest:
      o.pair_interaction_aspects != null ? stableStringify([...o.pair_interaction_aspects]) : null,
  };
  return crypto.createHash('sha256').update(stableStringify(payload), 'utf8').digest('hex');
}

export function withObjectIdentityHash(
  o: Omit<CanonicalReportObject, 'object_identity_hash'>
): CanonicalReportObject {
  const object_identity_hash = computeCanonicalObjectIdentityHash(o);
  return { ...o, object_identity_hash };
}
