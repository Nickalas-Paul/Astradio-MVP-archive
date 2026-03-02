/**
 * Phase 5 — Canonical 64-D feature indices.
 * Authoritative source: vnext/feature-encode.ts (read-only reference).
 *
 * Elements: fire, earth, air, water — 4 dims from EphemerisSnapshot.dominantElements.
 * Indices 27–30. May or may not sum to 1 (encoder outputs clamp01 per element).
 */

export const FEATURE_ELEMENT_INDICES = [27, 28, 29, 30] as const;
export const FEATURE_ELEMENT_COUNT = 4;
export const FEATURE_TENSION_INDEX = 32;
export const FEATURE_CLUSTER_INDEX = 33;
