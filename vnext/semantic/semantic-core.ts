import type {
  ClaimId,
  DerivationCode,
  RelationalBandCode,
  CrossChartDeltaCode,
  PhaseEmphasisCode,
  TensionBandCode,
  HarmonyBandCode,
  ClaimEdgeKind,
  SectionTemplateId,
  ToneFlagCode,
  TempoBandCode,
  DensityBandCode,
  ArcBiasCode,
  TensionBiasCode,
  RelationalTextureCode,
  NarrativeBeatCode,
  ChoiceFlagCode,
  StateTransitionCode,
} from './ontology-codes';
import { CORE_SCHEMA_VERSION } from './ontology-codes';

export type ClaimPolarity = 'constructive' | 'challenging' | 'neutral';

export interface SemanticClaim {
  readonly claim_id: ClaimId;
  readonly priority_rank: number;
  readonly strength: number;
  readonly polarity: ClaimPolarity;
  readonly participant_slot_indices: readonly number[];
  readonly derivation_code: DerivationCode;
}

export interface RelationalSemanticBlock {
  readonly activation_profile: readonly RelationalBandCode[];
  readonly cross_chart_delta_codes: readonly CrossChartDeltaCode[];
}

export interface TemporalWeightingBlock {
  readonly phase_emphasis: readonly PhaseEmphasisCode[];
  readonly transit_vs_natal_weight: number;
}

export interface TensionHarmonyBlock {
  readonly tension_band: TensionBandCode;
  readonly harmony_band: HarmonyBandCode;
  readonly claim_edges: readonly {
    from_claim_id: ClaimId;
    to_claim_id: ClaimId;
    edge_kind: ClaimEdgeKind;
  }[];
}

export interface TextProjectionEnvelope {
  readonly section_eligibility: readonly SectionTemplateId[];
  readonly emphasis_order: readonly SectionTemplateId[];
  readonly forbidden_tone_flags: readonly ToneFlagCode[];
}

export interface AudioProjectionEnvelope {
  readonly tempo_band: TempoBandCode;
  readonly density_band: DensityBandCode;
  readonly arc_bias: ArcBiasCode;
  readonly tension_bias: TensionBiasCode;
  readonly relational_texture: RelationalTextureCode;
}

export interface CampaignSemanticOverlay {
  readonly narrative_beat: NarrativeBeatCode;
  readonly choice_flags: readonly ChoiceFlagCode[];
  readonly state_transition_id: StateTransitionCode;
}

export interface SemanticCoreProvenance {
  readonly source_object_hash: string;
  readonly authority_version: string;
  readonly core_schema_version: string;
  readonly claim_index: Readonly<Partial<Record<ClaimId, { priority_rank: number; derivation_code: DerivationCode }>>>;
}

export interface SemanticCore {
  readonly provenance: SemanticCoreProvenance;
  readonly claims: readonly SemanticClaim[];
  readonly relational: RelationalSemanticBlock | null;
  readonly temporal: TemporalWeightingBlock | null;
  readonly tension_harmony: TensionHarmonyBlock | null;
  readonly text: TextProjectionEnvelope;
  readonly audio: AudioProjectionEnvelope;
  readonly campaign: CampaignSemanticOverlay | null;
}

export { CORE_SCHEMA_VERSION };
