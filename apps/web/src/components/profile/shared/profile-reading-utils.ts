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
  'contradiction_map',
  'todays_sound',
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

/** Identity tab display order helper (legacy filter for removed `audio_staging` is a no-op). */
export function filterIdentityDisplaySections<T extends { id: string }>(sections: readonly T[]): T[] {
  return [...sections];
}

export function mapExplanationToSections(explanation: unknown): ProfileChartSection[] {
  const exp = explanation as { sections?: Array<Record<string, unknown>> } | undefined;
  return (exp?.sections || []).map((x) => {
    const meta = x.meta as Record<string, unknown> | undefined;
    const transitCuration = meta?.transitCuration as
      | { natalBodies?: string[]; transitBodies?: string[]; aspectKeys?: string[] }
      | undefined;
    const metaPlanets = meta?.planets as string[] | undefined;

    let planets: string[] | undefined;
    if (transitCuration?.natalBodies || transitCuration?.transitBodies) {
      planets = [...(transitCuration.natalBodies || []), ...(transitCuration.transitBodies || [])].map((p) =>
        p.toLowerCase()
      );
    } else if (metaPlanets) {
      planets = metaPlanets.map((p) => p.toLowerCase());
    }

    let aspectKeys: string[] | undefined;
    if (transitCuration?.aspectKeys?.length) {
      aspectKeys = transitCuration.aspectKeys;
    } else if (Array.isArray(meta?.aspectKeys)) {
      aspectKeys = meta.aspectKeys as string[];
    }

    return {
      id: String(x.sectionId ?? x.id ?? 'signatures'),
      title: String(x.title ?? ''),
      text: String(x.text ?? ''),
      bullets: Array.isArray(x.bullets) ? (x.bullets as string[]) : undefined,
      ...(planets?.length ? { planets } : {}),
      ...(aspectKeys?.length ? { aspectKeys } : {}),
    };
  });
}
