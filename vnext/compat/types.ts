/**
 * Community Compatibility V1 — data types and constants.
 * Additive only; no changes to core pipeline.
 */

export const RELATIONSHIP_MODES = [
  'friends',
  'rivals',
  'lovers',
  'mentor',
  'collaborator',
  'neutral',
] as const;

export type RelationshipMode = typeof RELATIONSHIP_MODES[number];

export interface User {
  id: string;
  displayName: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chart {
  id: string;
  ownerId?: string;
  label: string;
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
  snapshotHash?: string;
  /** Persisted WAV export id for Profile natal identity audio (Lyria/export pipeline). */
  identityExportId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const FUSION_METHOD_BLEND_V1 = 'blend_v1' as const;

export interface FusionParams {
  wA: number;
  wB: number;
  /** Phase B epoch marker for comparison compose */
  compose_algorithm_version?: string;
  compose_skipped?: boolean;
}

export interface CompatibilityTextStructured {
  short: string;
  long: string;
  bullets: string[];
}

export type CompatibilityText = CompatibilityTextStructured | string;

export interface Comparison {
  id: string;
  chartAId: string;
  chartBId: string;
  /**
   * Explicit role semantics for Stage 2 dual-profile flows.
   * seekerChartId/targetChartId are the canonical fields for UI and API consumers.
   * For legacy records without these fields, API routes must normalize them from chartAId/chartBId.
   */
  seekerChartId?: string;
  targetChartId?: string;
  relationshipMode: RelationshipMode;
  fusionMethod: typeof FUSION_METHOD_BLEND_V1;
  fusionParams: FusionParams;
  mergedFeatureVector64: number[];
  mergedFeatureHash?: string;
  compatibilityText: CompatibilityText;
  planHash: string;
  compositionId: string;
  exportJobId?: string;
  createdAt: string;
  createdBy?: string;
  compatibilityFieldHash?: string;
  compatibilityRecord?: import('../compatibility/contracts').PersistedCompatibilityRecord;
  compatibilityField?: import('../compatibility/contracts').CanonicalRelationalFieldObject;
  scoring?: import('../compatibility/contracts').RelationalFieldScoreContract;
  classification?: import('../compatibility/contracts').CompatibilityClassification;
}

/** Inline chart B when not persisted */
export interface ChartBInline {
  label?: string;
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
  /** Alias for `timezone` (community / legacy clients). */
  tz?: string;
}
