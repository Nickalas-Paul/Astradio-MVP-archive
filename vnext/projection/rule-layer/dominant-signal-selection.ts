/**
 * Deterministic dominant-signal selection for mechanism-expression (`mep`) projection.
 * Read-only over `SemanticClaim[]`; no semantic authority mutation.
 */
import type { SemanticClaim } from '../../semantic/semantic-core';
import type { ClaimId } from '../../semantic/ontology-codes';
import { CLAIM_IDS } from '../../semantic/ontology-codes';
import type { ExpansionTier } from '../projection-types';

/** Collapse token within a derivation bucket — exhaustive over ontology `ClaimId`. */
const CLAIM_MECHANISM_SIGNAL_FAMILY: Record<ClaimId, string> = {
  ELEMENT_FIRE_DOM: 'element_fire_dom',
  ELEMENT_EARTH_DOM: 'element_earth_dom',
  ELEMENT_AIR_DOM: 'element_air_dom',
  ELEMENT_WATER_DOM: 'element_water_dom',
  ELEMENT_SECONDARY_FIRE: 'element_sec_fire',
  ELEMENT_SECONDARY_EARTH: 'element_sec_earth',
  ELEMENT_SECONDARY_AIR: 'element_sec_air',
  ELEMENT_SECONDARY_WATER: 'element_sec_water',
  MODALITY_CARDINAL: 'modality_cardinal',
  MODALITY_FIXED: 'modality_fixed',
  MODALITY_MUTABLE: 'modality_mutable',
  TENSION_BAND_LOW: 'tension_band',
  TENSION_BAND_MED: 'tension_band',
  TENSION_BAND_HIGH: 'tension_band',
  TONAL_BRIGHT: 'tonal',
  TONAL_BALANCED: 'tonal',
  TONAL_DARK: 'tonal',
  RESOLUTION_STRONG: 'resolution',
  RESOLUTION_MODERATE: 'resolution',
  RESOLUTION_SOFT: 'resolution',
  STRUCT_STELLIUM: 'struct_body',
  STRUCT_ANGULAR_FIRST: 'struct_body',
  STRUCT_ANGULAR_FOURTH: 'struct_body',
  STRUCT_ANGULAR_SEVENTH: 'struct_body',
  STRUCT_ANGULAR_TENTH: 'struct_body',
  STRUCT_LUMINARY_SUN: 'struct_body',
  STRUCT_LUMINARY_MOON: 'struct_body',
  STRUCT_LUMINARY_BALANCED: 'struct_body',
  STRUCT_ASPECT_TRINE_HEAVY: 'struct_body',
  STRUCT_ASPECT_SQUARE_HEAVY: 'struct_body',
  STRUCT_ASPECT_OPPOSITION_HEAVY: 'struct_body',
  CROSS_ELEMENT_DRIFT_HIGH: 'cross_element',
  CROSS_TENSION_DELTA_HIGH: 'cross_tension',
  REL_HARMONY_HIGH: 'rel_harmony',
  REL_HARMONY_MED: 'rel_harmony',
  REL_HARMONY_LOW: 'rel_harmony',
  REL_FRICTION_HIGH: 'rel_friction',
  REL_FRICTION_MED: 'rel_friction',
  REL_FRICTION_LOW: 'rel_friction',
  REL_INTENSITY_HIGH: 'rel_intensity',
  REL_INTENSITY_MED: 'rel_intensity',
  REL_INTENSITY_LOW: 'rel_intensity',
  MOTION_LABEL_SURGING: 'motion_surging',
  MOTION_LABEL_RESTLESS: 'motion_restless',
  MOTION_LABEL_QUIET_FLOW: 'motion_quiet_flow',
  MOTION_LABEL_INWARD: 'motion_inward',
  MOTION_LABEL_STEADY: 'motion_steady',
  GRAVITY_LABEL_ANCHORED: 'gravity_anchored',
  GRAVITY_LABEL_WEIGHTED_SPARK: 'gravity_weighted_spark',
  GRAVITY_LABEL_FLOATING: 'gravity_floating',
  GRAVITY_LABEL_LIGHT: 'gravity_light',
  GRAVITY_LABEL_BALANCED: 'gravity_balanced',
};

for (const id of CLAIM_IDS) {
  if (CLAIM_MECHANISM_SIGNAL_FAMILY[id] === undefined) {
    throw new Error(`[dominant-signal-selection] missing family for ${id}`);
  }
}

const SEP = '\u001f';

/** Derivation + family (polarity excluded — paired with polarity for partitioning). */
export function mechanismSignalGroupKey(claim: SemanticClaim): string {
  const fam = CLAIM_MECHANISM_SIGNAL_FAMILY[claim.claim_id as ClaimId];
  return `${claim.derivation_code}${SEP}${fam}`;
}

/** Mechanism family token for a claim (same table as `mechanismSignalGroupKey`). */
export function mechanismFamilyToken(claim: SemanticClaim): string {
  return CLAIM_MECHANISM_SIGNAL_FAMILY[claim.claim_id as ClaimId];
}

/**
 * Full partition key: same `mechanismSignalGroupKey` and same `polarity` iff same group.
 * No exceptions.
 */
export function mechanismGroupPartitionKey(claim: SemanticClaim): string {
  return `${mechanismSignalGroupKey(claim)}${SEP}${claim.polarity}`;
}

export function compareClaimsForDominance(a: SemanticClaim, b: SemanticClaim): number {
  if (b.strength !== a.strength) return b.strength - a.strength;
  if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
  return a.claim_id.localeCompare(b.claim_id);
}

export function dominantMechanismKForTier(tier: ExpansionTier): number {
  if (tier === 'baseline') return 2;
  return 3;
}

/**
 * One representative per `(mechanismSignalGroupKey, polarity)` group; at most one dominant per group
 * by construction. Returns ordered dominant `claim_id`s (global sort of representatives, then first K).
 */
export function selectDominantMechanismSignals(
  slice: readonly SemanticClaim[],
  tier: ExpansionTier
): readonly ClaimId[] {
  const groups = new Map<string, SemanticClaim[]>();
  for (const c of slice) {
    const k = mechanismGroupPartitionKey(c);
    const arr = groups.get(k);
    if (arr) arr.push(c);
    else groups.set(k, [c]);
  }

  const representatives: SemanticClaim[] = [];
  const sortedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  for (const k of sortedKeys) {
    const members = groups.get(k)!;
    members.sort(compareClaimsForDominance);
    representatives.push(members[0]!);
  }

  representatives.sort(compareClaimsForDominance);
  const K = dominantMechanismKForTier(tier);
  const cap = Math.min(K, representatives.length);
  return representatives.slice(0, cap).map((c) => c.claim_id as ClaimId);
}
