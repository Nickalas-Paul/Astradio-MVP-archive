/**
 * Campaign Phase 1 — contract types (Command-Center v1).
 * Synthetic traits are eligibility-only; see synthetic-trait.ts and resolve-campaign-daily.ts.
 */

export type PressureSourceMode = 'solo' | 'group_member';

export type PressureFamily =
  | 'identity'
  | 'emotional'
  | 'cognitive'
  | 'value'
  | 'conflict'
  | 'expansion'
  | 'constraint'
  | 'disruption'
  | 'dissolution'
  | 'transformation'
  | 'wound'
  | 'directional'
  | 'recurrence';

export type PressurePolarity = 'constructive' | 'frictional' | 'volatile' | 'binding';

export type PressureIntensityBand = 'low' | 'moderate' | 'high' | 'critical';

export type PressureInteractionHint =
  | 'reinforcing_candidate'
  | 'cross_pressuring_candidate'
  | 'escalating_candidate'
  | 'dissolving_candidate'
  | 'transforming_candidate'
  | 'none';

export type Phase1AspectType = 'conjunction' | 'opposition' | 'square' | 'trine' | 'sextile';

export type CampaignBodyId =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'chiron'
  | 'north_node'
  | 'south_node';

export type DomainId =
  | 'self'
  | 'assets'
  | 'communication'
  | 'home'
  | 'creativity'
  | 'work'
  | 'partnership'
  | 'transformation'
  | 'belief'
  | 'career'
  | 'community'
  | 'subconscious';

export type PressureEvent = {
  pressure_event_id: string;
  source_mode: PressureSourceMode;
  member_chart_id?: string;
  campaign_id: string;
  date: string;
  transit_body: CampaignBodyId;
  natal_body: CampaignBodyId;
  aspect_type: Phase1AspectType;
  natal_house: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  domain_id: DomainId;
  pressure_family: PressureFamily;
  pressure_polarity: PressurePolarity;
  interaction_hint: PressureInteractionHint;
  actual_orb_deg: number;
  allowed_orb_deg: number;
  aspect_weight: number;
  orb_score: number;
  source_weight: number;
  recurrence_weight: number;
  emphasis_weight: number;
  intensity_score: number;
  intensity_band: PressureIntensityBand;
  exactness_score: number;
  target_priority_score: number;
  activated_trait_ids: string[];
  identity_modifier_ids: string[];
  mechanic_tags: string[];
  provenance: {
    transit_snapshot_hash: string;
    natal_snapshot_hash: string;
    cross_aspect_hash: string;
    engine_version: string;
    rules_version: string;
  };
};

export type PressureInteractionType =
  | 'none'
  | 'reinforcing'
  | 'cross_pressuring'
  | 'escalating'
  | 'dissolving'
  | 'transforming';

export type SupportingPressureRef = {
  pressure_event_id: string;
  member_chart_id?: string;
  intensity_score: number;
  pressure_family: PressureFamily;
  domain_id: DomainId;
  natal_body: CampaignBodyId;
  natal_house: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  aspect_type: Phase1AspectType;
  pressure_polarity: PressurePolarity;
  intensity_band: PressureIntensityBand;
};

export type DailyPressureState = {
  daily_pressure_state_id: string;
  campaign_id: string;
  mode: 'solo' | 'group';
  date: string;
  primary_pressure_event_id: string;
  primary_transit_body: CampaignBodyId;
  primary_natal_body: CampaignBodyId;
  primary_natal_house: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  primary_aspect_type: Phase1AspectType;
  primary_pressure_family: PressureFamily;
  primary_pressure_polarity: PressurePolarity;
  primary_domain_id: DomainId;
  primary_intensity_score: number;
  primary_intensity_band: PressureIntensityBand;
  supporting_pressures: SupportingPressureRef[];
  interaction_type: PressureInteractionType;
  activated_trait_ids: string[];
  identity_modifier_ids: string[];
  mechanic_tags: string[];
  carryover_bias: number;
  uncertainty_modifier: number;
  event_count: number;
  eligible_event_count: number;
  ranking_trace: {
    candidate_pressure_event_ids: string[];
    filtered_out_event_ids: string[];
    merged_cluster_ids: string[];
    tie_break_rule_applied:
      | 'none'
      | 'source_weight'
      | 'orb_score'
      | 'activated_trait_count'
      | 'pressure_event_id';
  };
  group_context?: {
    member_count: number;
    contributing_member_chart_ids: string[];
    primary_member_chart_ids: string[];
  };
  provenance: {
    pressure_event_set_hash: string;
    engine_version: string;
    rules_version: string;
  };
};

export type CampaignResolutionSeed = {
  campaign_id: string;
  mode: 'solo' | 'group';
  date: string;
  character_sheet_id?: string;
  group_context_id?: string;
  pressure_events: PressureEvent[];
  daily_pressure_state: DailyPressureState | null;
  state_hash_before: string;
  trait_derivation_mode: 'phase1_synthetic_v1';
  provenance: {
    engine_version: string;
    rules_version: string;
    transit_snapshot_hash: string;
    relational_weather_state_hash?: string;
  };
  refusal?: {
    code: 'NO_PRIMARY_PRESSURE';
  };
};

export const CAMPAIGN_PHASE1_ENGINE_VERSION = 'campaign_phase1_v1';
export const CAMPAIGN_PHASE1_RULES_VERSION = 'campaign_contract_v1';
