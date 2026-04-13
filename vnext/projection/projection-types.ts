/**
 * **Proj:** Phase D — projection-layer options and validation (no semantic authority; legacy `phaseD` flag — not Product:Phase-*).
 */

import type { RelationshipMode } from '../compat/types';

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
    claimIdsReferenced?: string[];
    phaseD?: boolean;
    projection_validation?: ProjectionValidation;
    /** Phase 3 — excluded from explanation JSON hashing in compose. */
    tagged?: TaggedSectionBody;
    /** Phase 4 — diagnostic only; stripped for explanation hash. */
    phase4_composition?: Phase4CompositionReport;
  };
};
