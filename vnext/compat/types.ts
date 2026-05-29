/**
 * Community Compatibility V1 — data types and constants.
 * Additive only; no changes to core pipeline.
 *
 * **Phase 6C-Cleanup — deprecated relationship modes (soft-compat):**
 * API accepts legacy body values `rivals`, `mentor`, `collaborator` and normalizes server-side to `friends`.
 * UI selectors expose only canonical modes. DB may still store legacy strings; use `coerceRelationshipModeFromStorage` on read.
 *
 * **Deprecation timeline (document-only):** in ~2 releases after 6C, plan to hard-reject deprecated strings with HTTP 400
 * and code `DEPRECATED_RELATIONSHIP_MODE` instead of normalizing. Not implemented in this phase.
 */

export const RELATIONSHIP_MODES = ['friends', 'lovers', 'neutral'] as const;

export type RelationshipMode = (typeof RELATIONSHIP_MODES)[number];

/** Legacy POST/body values → canonical mode (all map to friends). */
export const DEPRECATED_RELATIONSHIP_MODE_ALIASES = {
  rivals: 'friends',
  mentor: 'friends',
  collaborator: 'friends',
} as const satisfies Record<string, RelationshipMode>;

/**
 * Strict parse for POST /api/comparisons: normalize deprecated aliases, reject unknown strings.
 * @throws Error with message suitable for 400 responses
 */
export function parseRelationshipModeInput(raw: unknown): RelationshipMode {
  if (raw == null || typeof raw !== 'string' || !raw.trim()) {
    throw new Error('relationshipMode required');
  }
  const k = raw.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(DEPRECATED_RELATIONSHIP_MODE_ALIASES, k)) {
    const canon = DEPRECATED_RELATIONSHIP_MODE_ALIASES[k as keyof typeof DEPRECATED_RELATIONSHIP_MODE_ALIASES];
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[compat] Deprecated relationshipMode '${raw}' normalized to '${canon}'`);
    }
    return canon;
  }
  if ((RELATIONSHIP_MODES as readonly string[]).includes(k)) {
    return k as RelationshipMode;
  }
  throw new Error(`Invalid relationship mode: ${raw}`);
}

/**
 * Read path: DB and older clients may send non-canonical strings; never throw. Unknown → friends.
 */
export function coerceRelationshipModeFromStorage(raw: string | undefined | null): RelationshipMode {
  if (raw == null || typeof raw !== 'string' || !raw.trim()) return 'friends';
  try {
    return parseRelationshipModeInput(raw);
  } catch {
    return 'friends';
  }
}

export interface User {
  id: string;
  displayName: string;
  email?: string;
  /** Phase 9C: true after email verification link is used. */
  emailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
  /** Phase 8G (Postgres). */
  discoverable?: boolean;
  show_in_feed?: boolean;
  /** Phase 7A+ (Postgres); optional in memory adapter. */
  bio?: string;
  avatarUrl?: string;
  discoverableAs?: string;
  lookingFor?: string;
  /** Phase 9A-1: up to 3 curated chart highlight strings. */
  chartHighlights?: string[];
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
