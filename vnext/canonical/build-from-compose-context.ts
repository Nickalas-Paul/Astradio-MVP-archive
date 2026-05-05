import type { EphemerisSnapshot, FeatureVec, SnapshotAspect } from '../contracts';
import type { AstroGuidance, MotionProfile } from '../astro/guidance';
import type { RelationalWeatherStateV1 } from '../relational/weather/types';
import { astroSummaryFromSnapshot } from '../explainer/astro-summary-from-snapshot';
import {
  type CanonicalReportObject,
  type MechanicalControlSignals,
  type ParticipantSlot,
  type SurfaceKind,
  SEMANTIC_AUTHORITY_VERSION,
} from './canonical-report-object';
import { featureVecFingerprint, snapshotFingerprint } from './stable-json';
import { withObjectIdentityHash } from './object-identity-hash';

const SCHEMA = 'canonical_report_v1' as const;
const ORDERING_LEXICAL_CHART = 'ordering_lexical_chart_v1';
const COMPOSITE_MEAN_NORMALIZED = 'composite_mean_normalized_v1';

function mechanicalFromGuidance(
  g: AstroGuidance & { motionProfile: MotionProfile }
): MechanicalControlSignals {
  return {
    tempoBias: g.tempoBias,
    arcBias: g.arcBias,
    densityBias: g.densityBias,
    motion: g.motionProfile.motion,
    flow: g.motionProfile.flow,
    gravity: g.motionProfile.gravity,
    shimmer: g.motionProfile.shimmer,
  };
}

function slotFromSnapshot(
  role: ParticipantSlot['slot_role'],
  index: number,
  snapshot: EphemerisSnapshot,
  vec: FeatureVec
): ParticipantSlot {
  const dom = astroSummaryFromSnapshot(snapshot, vec).dominant_planets ?? [];
  return {
    slot_role: role,
    slot_index: index,
    natal_snapshot: snapshot,
    feature_vec: vec,
    natal_snapshot_hash: snapshotFingerprint(snapshot),
    feature_vector_hash: featureVecFingerprint(vec),
    dominant_planet_names: [...dom],
  };
}

export function buildCanonicalReportForSnapshotSurface(params: {
  surface_kind: 'profile_natal' | 'home_daily';
  subject_ids: string[];
  snapshot: EphemerisSnapshot;
  featureVec: FeatureVec;
  control_surface_hash: string;
  compose_seed: string;
  guidance: AstroGuidance & { motionProfile: MotionProfile };
  transit_lock?: { ts: string; lat: number; lon: number; tz: string } | null;
  transit_snapshot_hash?: string | null;
}): CanonicalReportObject {
  const s = params.snapshot;
  const transit_lock =
    params.surface_kind === 'home_daily'
      ? (params.transit_lock ?? { ts: s.ts, lat: s.lat, lon: s.lon, tz: s.tz })
      : (params.transit_lock ?? null);
  const transit_snapshot_hash =
    params.surface_kind === 'home_daily'
      ? (params.transit_snapshot_hash ?? snapshotFingerprint(s))
      : (params.transit_snapshot_hash ?? null);
  const p0 = slotFromSnapshot('primary', 0, params.snapshot, params.featureVec);
  const base = {
    schema_version: SCHEMA,
    surface_kind: params.surface_kind,
    subject_ids: params.subject_ids,
    ordering_rule_id: ORDERING_LEXICAL_CHART,
    participants: [p0] as const,
    transit_lock,
    transit_snapshot_hash,
    composite_feature_vector: null,
    composite_algorithm_id: null,
    anchor_slot_index: null,
    relational_weather: null,
    relational_weather_state_hash: null,
    control_surface_hash: params.control_surface_hash,
    compose_seed: params.compose_seed,
    mechanical: mechanicalFromGuidance(params.guidance),
    ml_stack_version: process.env.RUNTIME_MODEL || 'student-v2.8-slice-batch',
    planner_version: 'narrative-v1',
    semantic_authority_version: SEMANTIC_AUTHORITY_VERSION,
    gate_policy_version: 'audition-v2.3',
  };
  return withObjectIdentityHash(base);
}

export function buildCanonicalReportForOverlay(params: {
  subject_ids: string[];
  natalSnapshot: EphemerisSnapshot;
  natalFeatureVec: FeatureVec;
  transitSnapshot: EphemerisSnapshot;
  transitFeatureVec: FeatureVec;
  control_surface_hash: string;
  compose_seed: string;
  guidance: AstroGuidance & { motionProfile: MotionProfile };
  pair_interaction_aspects?: readonly SnapshotAspect[];
}): CanonicalReportObject {
  const p0 = slotFromSnapshot('primary', 0, params.natalSnapshot, params.natalFeatureVec);
  const p1 = slotFromSnapshot('secondary', 1, params.transitSnapshot, params.transitFeatureVec);
  const transit_lock = {
    ts: params.transitSnapshot.ts,
    lat: params.transitSnapshot.lat,
    lon: params.transitSnapshot.lon,
    tz: params.transitSnapshot.tz,
  };
  const base = {
    schema_version: SCHEMA,
    surface_kind: 'comparison_pair' as SurfaceKind,
    subject_ids: params.subject_ids,
    ordering_rule_id: ORDERING_LEXICAL_CHART,
    participants: [p0, p1] as const,
    transit_lock,
    transit_snapshot_hash: snapshotFingerprint(params.transitSnapshot),
    composite_feature_vector: null,
    composite_algorithm_id: null,
    anchor_slot_index: null,
    relational_weather: null,
    relational_weather_state_hash: null,
    control_surface_hash: params.control_surface_hash,
    compose_seed: params.compose_seed,
    mechanical: mechanicalFromGuidance(params.guidance),
    ml_stack_version: process.env.RUNTIME_MODEL || 'student-v2.8-slice-batch',
    planner_version: 'narrative-v1',
    semantic_authority_version: SEMANTIC_AUTHORITY_VERSION,
    gate_policy_version: 'audition-v2.3',
    ...(params.pair_interaction_aspects != null
      ? { pair_interaction_aspects: params.pair_interaction_aspects }
      : {}),
  };
  return withObjectIdentityHash(base);
}

export function buildCanonicalReportForAggregate(params: {
  kind: 'comparison' | 'group';
  subject_ids: string[];
  participants: Array<{ snapshot: EphemerisSnapshot; featureVec: FeatureVec; role: ParticipantSlot['slot_role'] }>;
  composite: FeatureVec;
  anchorIndex: number;
  control_surface_hash: string;
  compose_seed: string;
  guidance: AstroGuidance & { motionProfile: MotionProfile };
  relationalWeather?: RelationalWeatherStateV1 | null;
  /** Set by compose for `kind: 'comparison'` when synastry is computed (S3+). */
  pair_interaction_aspects?: readonly SnapshotAspect[];
}): CanonicalReportObject {
  const slots: ParticipantSlot[] = params.participants.map((p, i) =>
    slotFromSnapshot(p.role, i, p.snapshot, p.featureVec)
  );
  const rw = params.relationalWeather ?? null;
  const base = {
    schema_version: SCHEMA,
    surface_kind: 'overlay_aggregate' as SurfaceKind,
    subject_ids: params.subject_ids,
    ordering_rule_id: ORDERING_LEXICAL_CHART,
    participants: slots,
    transit_lock: null,
    transit_snapshot_hash: null,
    composite_feature_vector: params.composite,
    composite_algorithm_id: COMPOSITE_MEAN_NORMALIZED,
    anchor_slot_index: params.anchorIndex,
    relational_weather: rw,
    relational_weather_state_hash: rw?.stateHash ?? null,
    control_surface_hash: params.control_surface_hash,
    compose_seed: params.compose_seed,
    mechanical: mechanicalFromGuidance(params.guidance),
    ml_stack_version: process.env.RUNTIME_MODEL || 'student-v2.8-slice-batch',
    planner_version: 'narrative-v1',
    semantic_authority_version: SEMANTIC_AUTHORITY_VERSION,
    gate_policy_version: 'audition-v2.3',
    ...(params.pair_interaction_aspects != null
      ? { pair_interaction_aspects: params.pair_interaction_aspects }
      : {}),
  };
  return withObjectIdentityHash(base);
}
