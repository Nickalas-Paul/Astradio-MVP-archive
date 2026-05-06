/**
 * Canonical relationship modes for Community compatibility UI (Phase 6C-Cleanup).
 * API may still accept legacy strings server-side; see vnext `parseRelationshipModeInput`.
 *
 * Hard cutoff of deprecated body values is planned ~2 releases post-6C (400 + error code); not enforced yet.
 */

export const RELATIONSHIP_MODES = ['friends', 'lovers'] as const;

export type RelationshipMode = (typeof RELATIONSHIP_MODES)[number];

export const RELATIONSHIP_MODE_OPTIONS: Array<{ value: RelationshipMode; label: string }> = [
  { value: 'friends', label: 'Friends' },
  { value: 'lovers', label: 'Lovers' },
];
