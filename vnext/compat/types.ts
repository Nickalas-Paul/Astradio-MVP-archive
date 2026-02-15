/**
 * Community Compatibility V1 — data types and constants.
 * Additive only; no changes to core pipeline.
 */

export type RelationshipMode =
  | 'friends'
  | 'rivals'
  | 'lovers'
  | 'mentor'
  | 'collaborator'
  | 'neutral';

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
  createdAt: string;
  updatedAt: string;
}

export const FUSION_METHOD_BLEND_V1 = 'blend_v1' as const;

export interface FusionParams {
  wA: number;
  wB: number;
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
}

/** Inline chart B when not persisted */
export interface ChartBInline {
  label?: string;
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
}
