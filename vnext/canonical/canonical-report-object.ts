import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { RelationalWeatherStateV1 } from '../relational/weather/types';

export type SurfaceKind =
  | 'profile_natal'
  | 'home_daily'
  | 'comparison_pair'
  | 'overlay_aggregate';

export type ParticipantSlotRole = 'primary' | 'secondary' | 'transit_field' | 'member_i';

export interface ParticipantSlot {
  readonly slot_role: ParticipantSlotRole;
  readonly slot_index: number;
  readonly natal_snapshot: EphemerisSnapshot | null;
  readonly feature_vec: FeatureVec | null;
  readonly natal_snapshot_hash: string;
  readonly feature_vector_hash: string;
  /** Mechanical ephemeris labels (sorted, from astro summary); not semantic claims. */
  readonly dominant_planet_names: readonly string[];
}

/** Mechanical control scalars from upstream (non-semantic); produced only for planner/audio engineering. */
export interface MechanicalControlSignals {
  readonly tempoBias: number;
  readonly arcBias: number;
  readonly densityBias: number;
  readonly motion: number;
  readonly flow: number;
  readonly gravity: number;
  readonly shimmer: number;
}

export interface CanonicalReportObject {
  readonly schema_version: 'canonical_report_v1';
  readonly surface_kind: SurfaceKind;
  readonly subject_ids: readonly string[];
  readonly ordering_rule_id: string;
  readonly participants: readonly ParticipantSlot[];
  readonly transit_lock: { readonly ts: string; readonly lat: number; readonly lon: number; readonly tz: string } | null;
  readonly transit_snapshot_hash: string | null;
  readonly composite_feature_vector: FeatureVec | null;
  readonly composite_algorithm_id: string | null;
  readonly anchor_slot_index: number | null;
  readonly relational_weather: RelationalWeatherStateV1 | null;
  readonly relational_weather_state_hash: string | null;
  readonly control_surface_hash: string;
  readonly compose_seed: string;
  readonly mechanical: MechanicalControlSignals;
  readonly ml_stack_version: string;
  readonly planner_version: string;
  readonly semantic_authority_version: string;
  readonly gate_policy_version: string;
  /** Populated after computeCanonicalObjectIdentityHash */
  readonly object_identity_hash: string;
}

export const SEMANTIC_AUTHORITY_VERSION = 'phase-b-1';
