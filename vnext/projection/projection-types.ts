/**
 * **Proj:** Phase D — projection-layer options and validation (no semantic authority; legacy `phaseD` flag — not Product:Phase-*).
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import type { RelationshipMode } from '../compat/types';
import type { EphemerisSnapshot, SnapshotAspect } from '../contracts';
import type { ComparisonSeekerContextV1, DirectedSnapshotAspect } from '../synastry/synastry-types';
import type { AggregateParticipantLabelV1 } from '../relational/composition/resolve-participant-labels';

export type ExpansionTier = 'baseline' | 'expanded' | 'extended';

/** Product projection surface (may differ from canonical surface_kind). */
export type ProjectionSurface =
  | 'profile'
  | 'daily'
  | 'sandbox'
  | 'overlay_pair'
  | 'compat_pair'
  | 'group'
  | 'campaign'
  | 'feed';

export type ConnectionMode = RelationshipMode | 'group' | undefined;

export type DensityClass = 'short' | 'medium' | 'long';

/** Temperament axes mirrored from CharacterProfile (deterministic copy only). */
export type CampaignLensTemperament = {
  readonly will: number;
  readonly insight: number;
  readonly attunement: number;
  readonly courage: number;
  readonly discipline: number;
  readonly adaptability: number;
  readonly bond: number;
  readonly shadowCapacity: number;
  readonly radiance: number;
};

export type CampaignLensAngularEmphasis = {
  readonly first: boolean;
  readonly fourth: boolean;
  readonly seventh: boolean;
  readonly tenth: boolean;
};

export type CampaignLensDomainScoreEntry = {
  readonly domain: string;
  readonly score: number;
};

export type CampaignLensSignatureDomainEntry = {
  readonly domain: string;
  readonly weight: number;
};

/**
 * Read-only, bounded facts already resolved by Campaign Command Center for campaign-surface
 * expression only. Non-authoritative: must not drive claim creation or canonical meaning.
 *
 * **Character Lens (Level 1):** this object is the single source of lens + progression snapshot
 * for `surface: 'campaign'`. Pressure is authoritative; identity mirrors shape expression only;
 * `continuity` is the only progression slice projection may use (never raw CampaignState).
 */
export type CampaignExpressionDigest = {
  readonly identity: {
    readonly profile_id: string;
    readonly class_slug: string;
    readonly subclass_slug: string;
    readonly rising_modifier_slug: string;
    readonly top_domain_slug: string;
    readonly primary_element: 'fire' | 'earth' | 'air' | 'water';
    readonly tonal_polarity: 'bright' | 'balanced' | 'dark';
    readonly luminary_weight: 'sun' | 'moon' | 'balanced';
    readonly motion_profile: string;
    readonly gravity_profile: string;
    readonly dominant_planets: readonly string[];
    readonly angular_emphasis: CampaignLensAngularEmphasis;
    readonly temperament: CampaignLensTemperament;
    readonly top_domains_ranked: readonly CampaignLensDomainScoreEntry[];
    readonly signature_domains_ranked: readonly CampaignLensSignatureDomainEntry[];
    /** Pooled pressure-contact tags from DailyPressureState (not core identity). */
    readonly pressure_contact_modifier_ids: readonly string[];
  };
  readonly pressure: {
    readonly primary_domain_id: string;
    readonly primary_intensity_band: string;
    readonly primary_pressure_family: string;
    readonly primary_pressure_polarity: string;
    readonly interaction_type: string;
    readonly primary_transit_body: string;
    readonly primary_natal_body: string;
    readonly primary_natal_house: number;
    readonly primary_aspect_type: string;
    readonly supporting_count: number;
  };
  readonly continuity: {
    readonly chapter: number;
    readonly dominant_tone_key: string;
    readonly top_domain_key: string | null;
    readonly last_outcome_direction?:
      | 'assert_define'
      | 'engage_advance'
      | 'observe_hold'
      | 'withdraw_protect'
      | 'support_connect'
      | 'offer_restore'
      | 'reframe_integrate'
      | 'contain_limit';
  };
  /** Mirror of DailyPressureState.mode — no aggregation. */
  readonly campaign_mode: 'solo' | 'group';
  /** Mirror of group_context.member_count when present; 0 when solo or absent. */
  readonly group_member_count: number;
  /** Sorted copy of group_context.contributing_member_chart_ids; empty when N/A. */
  readonly group_contributing_member_chart_ids: readonly string[];
  /** Sorted copy of group_context.primary_member_chart_ids; empty when N/A. */
  readonly group_primary_member_chart_ids: readonly string[];
};

export type ProjectionOptions = {
  /** When false or omitted with no third argument legacy entrypoint, skip **Proj:** Phase D post-process (not a product phase). */
  phaseD?: boolean;
  surface: ProjectionSurface;
  tier?: ExpansionTier;
  /** Dyadic relationship mode from adapters (not inferred from chart). */
  connectionMode?: ConnectionMode;
  /** Multi-user aggregate: N >= 2 from canonical participants. */
  participantCount?: number;
  /** Precomputed narrative plan — same object used for Lyria when present. */
  narrativePlan?: import('../audio/composition-narrative').CompositionNarrativePlan | null;
  /** Control payload aspect_tension (already used in narrative plan). */
  aspectTension?: number | null;
  /** Canonical aggregate runner kind (surface_kind is always overlay_aggregate). */
  aggregateKind?: 'comparison' | 'group';
  /**
   * @internal Gate A — preserve user-requested tier across a single downgrade retry (same seed).
   */
  originalTierRequested?: ExpansionTier;
  /**
   * @internal Gate A — violations from the failed higher-tier attempt (copied before retry).
   */
  _priorAttemptViolations?: string[];
  /**
   * When true, mechanism-expression (`mep`) uses dominant-signal ordering and tail relatedness rules.
   * Omitted or false preserves legacy `mep` construction.
   */
  mechanismExpressionDominantSignals?: boolean;
  /**
   * Optional read-only digest of already-computed Campaign daily facts for `surface: 'campaign'`
   * expression wiring only. Invalid on other surfaces (enforced in apply-unified-projection).
   */
  campaignExpressionDigest?: CampaignExpressionDigest;
  /** Natal snapshot aspects for insight-library aspect lookups (not on SemanticCore at runtime). */
  snapshotAspects?: readonly SnapshotAspect[];
  /** Synastry cross-chart aspects; when set with length ≥ 1, supersedes anchor snapshotAspects for library lookup. */
  pairInteractionAspects?: readonly SnapshotAspect[];
  /** Phase 6C — directed synastry rows (with slot indices). When set, prefer for seeker-anchored assembly. */
  pairInteractionAspectsV2?: readonly DirectedSnapshotAspect[];
  /** Phase 6C — seeker/target chart mapping to participant slots (comparison aggregates). */
  comparisonSeekerContextV1?: ComparisonSeekerContextV1;
  /** How pair_interaction_aspects were produced (projection-only discriminator). */
  synastry_context?: 'pair_comparison' | 'group_aggregate' | 'sandbox_override';
  /** Compatibility classification class_code for relational insight (compat surfaces). */
  compatClassCode?: string;
  /** Relational weather dominant theme tags for insight-library (aggregate / feed). */
  relationalWeatherThemes?: readonly string[];
  /** Optional chart snapshot for placement-key section assembly on profile surface. */
  snapshot?: EphemerisSnapshot;
  /** Optional secondary chart snapshot for overlay/transit activation assembly. */
  secondarySnapshot?: EphemerisSnapshot;
  /** Phase 6E — group aggregate: display labels per participant slot (YOUR vs names vs Person N). */
  aggregateParticipantLabelsV1?: readonly AggregateParticipantLabelV1[];
  /** When true, skip generic `ensemble_framing` preface (e.g. Sandbox multi-chart resolve). */
  suppressEnsembleFraming?: boolean;
  /** Profile overlay: prior day aspect keys for cross-day diversification (optional). */
  transitDiversificationContext?: import('./rule-layer/transit-overlay-curation').TransitDiversificationContext | null;
  /** Profile overlay: YYYY-MM-DD for transit snapshot (diversification persistence). */
  transitCalendarDate?: string;
};

export type Phase4UnitRef = {
  sectionId: string;
  unit: 'paragraph' | 'bullet';
  paragraphIndex: number;
  bulletIndex?: number;
  reason: 'UNIT_INFEASIBLE';
};

export type Phase4CompositionReport = {
  unitInfeasible: Phase4UnitRef[];
  audioThreadRelocated: boolean;
};

export type ProjectionValidation = {
  ok: boolean;
  tierRequested: ExpansionTier;
  tierEffective: ExpansionTier;
  downgradedFrom?: ExpansionTier;
  violations: string[];
  /** Present only after a downgrade retry; copies the failed attempt’s violation list. */
  prior_attempt_violations?: string[];
};

export type SurfaceSectionSchema = {
  sectionKey: string;
  density: DensityClass;
  minClaimsReferenced: number;
  /** Template ids from core emphasis that map to this logical section (optional grouping). */
  templateIds?: string[];
};

export type SurfaceSchemaDefinition = {
  surface: ProjectionSurface;
  baselineDensityDefault: DensityClass;
  baselineMinSections: number;
  maxSectionsFeed?: number;
  sections: SurfaceSectionSchema[];
  expansionSectionKeys: { expanded: string[]; extended: string[] };
};

/** Phase 3 — provenance union (assigned at source, propagated only). */
export type ProvenanceType =
  | 'claim_body'
  | 'template'
  | 'preface'
  | 'audio_staging'
  | 'audio_thread'
  | 'tier_scaffold'
  | 'synthesis_wrapper'
  | 'padding'
  | 'contextual_pad'
  | 'neutral_pad'
  | 'section_bridge'
  | 'assembler_glue';

export type TaggedSentence = {
  text: string;
  provenance: ProvenanceType;
  /**
   * When tone-pass applied missing_hedge, the first row may be `padding` for the full linted
   * first sentence while `contentProvenance` records the inner sentences' provenance for
   * collapse lint-strip (removes hedge prefix bytes-identical to repetition-collapse).
   */
  contentProvenance?: ProvenanceType;
};

export type TaggedParagraph = {
  sentences: TaggedSentence[];
};

export type TaggedSectionBody = {
  paragraphs: TaggedParagraph[];
  /** One entry per `bullets[i]` when bullets exist. */
  bulletBlocks?: TaggedSectionBody[];
};

export type ProjectedExplanationSection = {
  id: string;
  title: string;
  text: string;
  bullets?: string[];
  meta?: {
    /** Density passed to `enrichSectionTextWithTagged` for this section (validation uses this when set). */
    enrichDensity?: DensityClass;
    claimIdsReferenced?: string[];
    phaseD?: boolean;
    projection_validation?: ProjectionValidation;
    /** Phase 3 — excluded from explanation JSON hashing in compose. */
    tagged?: TaggedSectionBody;
    /** Phase 4 — diagnostic only; stripped for explanation hash. */
    phase4_composition?: Phase4CompositionReport;
    /**
     * Phase 4 — last expression fallback path (assembly diagnostics). Optional; not hashed.
     */
    phase4_source_path?: Phase4ContentSourcePath;
    /** Profile overlay: per-section curation metadata (not hashed). */
    transitCuration?: {
      aspectKeys: string[];
      natalBodies: string[];
      transitBodies: string[];
      calendarDate: string;
    };
    /** Identity tier sections: uppercase planet names covered by this section. */
    planets?: string[];
    /** Natal or synastry aspects section: canonical aspect keys referenced in prose. */
    aspectKeys?: string[];
    /** Profile overlay: full-day selected activations for persistence. */
    transitCurationFull?: import('./rule-layer/transit-overlay-curation').TransitDiversificationContext;
  };
};

/** How non-claim sentences were last resolved in the fallback chain. */
export type Phase4ContentSourcePath =
  | 'claim_slice'
  | 'alt_role'
  | 'shortform'
  | 'contextual_pad'
  | 'neutral_pad'
  | 'section_bridge'
  | 'template_only';
