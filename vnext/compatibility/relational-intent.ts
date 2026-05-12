/**
 * Canonical relational intent enum — single authority for discovery ranking,
 * intent clusters, and connection request relationship_kind.
 */

export const RELATIONAL_INTENTS = ['friend', 'lover'] as const;

export type RelationalIntent = (typeof RELATIONAL_INTENTS)[number];

export function isRelationalIntent(s: string): s is RelationalIntent {
  return (RELATIONAL_INTENTS as readonly string[]).includes(s);
}

/** Parse query/body param; returns null if invalid. */
export function parseRelationalIntent(s: unknown, fallback: RelationalIntent = 'friend'): RelationalIntent {
  if (typeof s !== 'string' || !s.trim()) return fallback;
  const t = s.trim().toLowerCase();
  return isRelationalIntent(t) ? t : fallback;
}

/** Map legacy API values to canonical intent (for transitional request bodies only). */
export function mapLegacyIntentToRelational(s: string): RelationalIntent | null {
  const m: Record<string, RelationalIntent> = {
    friendship: 'friend',
    dating: 'lover',
    collaboration: 'friend',
    mentor: 'friend',
    roommate: 'friend',
    study: 'friend',
    friend: 'friend',
    lover: 'lover',
    /** Legacy discovery intents → friend (Phase 7A-2). */
    rival: 'friend',
    rivals: 'friend',
    collaborator: 'friend',
  };
  const k = s.trim().toLowerCase();
  return m[k] ?? null;
}

export const RELATIONAL_INTENT_DISPLAY: Record<RelationalIntent, string> = {
  friend: 'Friend',
  lover: 'Lover',
};
