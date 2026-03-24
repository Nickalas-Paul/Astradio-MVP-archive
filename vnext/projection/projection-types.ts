/**
 * Phase D — projection-layer options and validation (no semantic authority).
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
  /** When false or omitted with no third argument legacy entrypoint, skip Phase D post-process. */
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
};

export type ProjectionValidation = {
  ok: boolean;
  tierEffective: ExpansionTier;
  downgradedFrom?: ExpansionTier;
  violations: string[];
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

export type ProjectedExplanationSection = {
  id: string;
  title: string;
  text: string;
  bullets?: string[];
  meta?: {
    claimIdsReferenced?: string[];
    phaseD?: boolean;
    projection_validation?: ProjectionValidation;
  };
};
