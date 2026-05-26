import type { ProfileChartSection } from '../../../core/social/hooks';

/** Matches server `filterAndOrderPhase3Sections` / compat surfaces; unknown ids sort after known. */
export const SECTION_ORDER: string[] = [
  'connection_structure',
  'ensemble_framing',
  'relational_field',
  'relational_weather_v1',
  'core_identity',
  'direction_foundation',
  'personal_expression',
  'growth_expansion',
  'evolutionary_currents',
  'aspects',
  'signatures',
  'significance',
  'trait_bridge',
  'interaction_map',
  'field_distribution',
  'synthesis_a',
  'synthesis_b',
  'musical',
  'contradiction_map',
  'todays_sound',
  'audio_staging',
  'audio_thread',
];

export const SECTION_TITLES: Record<string, string> = {
  core_identity: 'Core Identity Architecture',
  direction_foundation: 'Direction and Foundation',
  personal_expression: 'Personal Expression',
  growth_expansion: 'Growth and Expansion',
  evolutionary_currents: 'Evolutionary Currents',
  aspects: 'Planetary Relationships',
  signatures: 'Astrology',
  significance: 'Personal Significance',
  musical: 'Music Theory',
  relational_weather_v1: 'Current Activation',
  todays_sound: "Today's Sound",
};

export function sectionSortKey(id: string): number {
  const i = SECTION_ORDER.indexOf(id);
  if (i >= 0) return i;
  const m = /^depth_panel_(\d+)$/.exec(id);
  if (m) return SECTION_ORDER.length + parseInt(m[1]!, 10);
  return 200 + (id ? id.charCodeAt(0) : 0);
}

/** Identity tab: hide pipeline-only sections; raw data still used for audio generation. */
export function filterIdentityDisplaySections<T extends { id: string }>(sections: readonly T[]): T[] {
  return sections.filter((section) => section.id !== 'audio_staging');
}

export function mapExplanationToSections(explanation: unknown): ProfileChartSection[] {
  const exp = explanation as { sections?: Array<Record<string, unknown>> } | undefined;
  return (exp?.sections || []).map((x) => ({
    id: String(x.sectionId ?? x.id ?? 'signatures'),
    title: String(x.title ?? ''),
    text: String(x.text ?? ''),
    bullets: Array.isArray(x.bullets) ? (x.bullets as string[]) : undefined,
  }));
}
