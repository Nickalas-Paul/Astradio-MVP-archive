/**
 * Phase 3B — Intent input model: chips → facets mapping (frontend only, deterministic).
 * Do NOT expose weights to user. Max 3 chips.
 */

export type IntentType =
  | 'friendship'
  | 'dating'
  | 'collaboration'
  | 'mentor'
  | 'roommate'
  | 'study';

export type ScopeType = 'my_groups' | 'this_group' | 'global';

export const INTENT_OPTIONS: { value: IntentType; label: string }[] = [
  { value: 'friendship', label: 'Friendship' },
  { value: 'dating', label: 'Dating' },
  { value: 'collaboration', label: 'Collaboration' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'roommate', label: 'Roommate' },
  { value: 'study', label: 'Study' },
];

export const SCOPE_OPTIONS: { value: ScopeType; label: string }[] = [
  { value: 'my_groups', label: 'My groups' },
  { value: 'this_group', label: 'This group' },
  { value: 'global', label: 'Global' },
];

/** Backend scope values (this_group → group) */
export type BackendScopeType = 'my_groups' | 'group' | 'global';

export function toBackendScope(scope: ScopeType): BackendScopeType {
  return scope === 'this_group' ? 'group' : scope;
}

export const CHIP_OPTIONS: { value: string; label: string }[] = [
  { value: 'deep_conversation', label: 'Deep conversation' },
  { value: 'emotional_steadiness', label: 'Emotional steadiness' },
  { value: 'creative_spark', label: 'Creative spark' },
  { value: 'low_drama', label: 'Low drama' },
  { value: 'high_growth', label: 'High growth' },
  { value: 'accountability', label: 'Accountability' },
  { value: 'playful', label: 'Playful' },
  { value: 'long_term', label: 'Long term' },
  { value: 'short_term_project', label: 'Short-term project' },
];

export const MAX_CHIPS = 3;

export interface FacetsWeights {
  communication?: number;
  emotional?: number;
  growth?: number;
  creative?: number;
}

/** Deterministic: chips → facets. Base 0.5, each chip adds/subtracts. Clamp 0..1. */
const CHIP_TO_FACETS: Record<string, Partial<FacetsWeights>> = {
  deep_conversation: { communication: 0.2, emotional: 0.2 },
  emotional_steadiness: { emotional: 0.25 },
  creative_spark: { creative: 0.3 },
  low_drama: { emotional: -0.15, growth: 0.1 },
  high_growth: { growth: 0.3 },
  accountability: { growth: 0.2, communication: 0.15 },
  playful: { creative: 0.2, emotional: 0.1 },
  long_term: { emotional: 0.15, growth: 0.2 },
  short_term_project: { communication: 0.2, creative: 0.15 },
};

export function chipsToFacets(chips: string[]): FacetsWeights {
  const selected = chips.slice(0, MAX_CHIPS);
  const out: FacetsWeights = { communication: 0.5, emotional: 0.5, growth: 0.5, creative: 0.5 };
  for (const chip of selected) {
    const delta = CHIP_TO_FACETS[chip];
    if (!delta) continue;
    for (const [k, v] of Object.entries(delta)) {
      const key = k as keyof FacetsWeights;
      if (out[key] !== undefined && typeof v === 'number') {
        (out as Record<string, number>)[key] = Math.max(0, Math.min(1, (out[key] ?? 0.5) + v));
      }
    }
  }
  return out;
}

export function bandLabel(band: string): string {
  switch (band) {
    case 'ease': return 'Easy conversation';
    case 'spark': return 'Creative spark';
    case 'growth': return 'Growth edge';
    case 'complex': return 'Complex blend';
    default: return band;
  }
}
