export const RELATIONSHIP_MODES = [
  'friends',
  'rivals',
  'lovers',
  'mentor',
  'collaborator',
  'neutral',
] as const;

export type RelationshipMode = (typeof RELATIONSHIP_MODES)[number];

export const RELATIONSHIP_MODE_OPTIONS: Array<{ value: RelationshipMode; label: string }> = [
  { value: 'friends', label: 'Friends' },
  { value: 'rivals', label: 'Rivals' },
  { value: 'lovers', label: 'Lovers' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'collaborator', label: 'Collaborator' },
  { value: 'neutral', label: 'Neutral' },
];

