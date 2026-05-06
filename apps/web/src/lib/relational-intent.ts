/**
 * Canonical relational intent for discovery/ranking — must match `vnext/compatibility/relational-intent.ts`.
 * Community **comparison** POST body uses `relationshipMode` `friends` | `lovers` only in the UI; engine accepts `neutral` and normalizes legacy aliases server-side.
 */
export type RelationalIntent = 'friend' | 'lover' | 'rival' | 'collaborator';

export const RELATIONAL_INTENT_OPTIONS: { value: RelationalIntent; label: string }[] = [
  { value: 'friend', label: 'Friend' },
  { value: 'lover', label: 'Lover' },
  { value: 'rival', label: 'Rival' },
  { value: 'collaborator', label: 'Collaborator' },
];
