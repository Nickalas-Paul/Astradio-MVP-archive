/** Canonical relational intent — must match vnext/compatibility/relational-intent.ts */
export type RelationalIntent = 'friend' | 'lover' | 'rival' | 'collaborator';

export const RELATIONAL_INTENT_OPTIONS: { value: RelationalIntent; label: string }[] = [
  { value: 'friend', label: 'Friend' },
  { value: 'lover', label: 'Lover' },
  { value: 'rival', label: 'Rival' },
  { value: 'collaborator', label: 'Collaborator' },
];
