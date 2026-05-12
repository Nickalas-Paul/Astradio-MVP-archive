/**
 * Canonical relational intent for discovery/ranking — must match `vnext/compatibility/relational-intent.ts`.
 * Community **comparison** POST body uses `relationshipMode` `friends` | `lovers` only in the UI; engine accepts `neutral` and normalizes legacy aliases server-side.
 */
export type RelationalIntent = 'friend' | 'lover';

/** Short labels for chips and UI (lover → Partner in Discovery). */
export const RELATIONAL_INTENT_LABELS: Record<RelationalIntent, string> = {
  friend: 'Friend',
  lover: 'Partner',
};

export const RELATIONAL_INTENT_OPTIONS: { value: RelationalIntent; label: string }[] = [
  { value: 'friend', label: RELATIONAL_INTENT_LABELS.friend },
  { value: 'lover', label: RELATIONAL_INTENT_LABELS.lover },
];
