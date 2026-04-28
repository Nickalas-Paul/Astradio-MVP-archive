/**
 * Maps existing compose/projection section ids to product-facing expanded slots.
 * Presentation only — no generation.
 */

import { stripReadingPresentationNoise } from './reading-presentation-filter';

export type ExpandedSlotId = 'summary' | 'support' | 'tension' | 'activation' | 'whatToDo' | 'audio';

export const EXPANDED_SLOT_LABELS: Record<ExpandedSlotId, string> = {
  summary: 'Summary',
  support: 'Support',
  tension: 'Tension',
  activation: 'Current Activation',
  whatToDo: 'What to Do',
  audio: 'Audio Translation',
};

type RawSection = { id?: string; sectionId?: string; title?: string; text?: string; bullets?: string[] };

function sectionIdOf(s: RawSection): string {
  return String(s.sectionId ?? s.id ?? '').trim();
}

function joinText(parts: (string | undefined)[]): string {
  return parts.filter((p) => typeof p === 'string' && p.trim().length > 0).join('\n\n').trim();
}

function bulletsToText(bullets: string[] | undefined): string {
  if (!bullets?.length) return '';
  return bullets.map((b) => `• ${b}`).join('\n');
}

/** Pull sections from compose artifact text blob. */
export function extractSectionsFromArtifact(artifact: Record<string, unknown>): RawSection[] {
  const text = artifact.text;
  if (text && typeof text === 'object' && !Array.isArray(text)) {
    const t = text as Record<string, unknown>;
    const expl = t.explanation as { sections?: RawSection[] } | undefined;
    if (expl?.sections && Array.isArray(expl.sections)) return expl.sections;
    const secs = t.sections;
    if (Array.isArray(secs)) return secs as RawSection[];
  }
  return [];
}

/**
 * Assigns known projection ids into expanded slots. Unknown ids are appended to Summary if non-empty.
 */
export function mapSectionsToExpandedSlots(sections: RawSection[]): Record<ExpandedSlotId, string> {
  const byId = new Map<string, RawSection>();
  for (const s of sections) {
    const id = sectionIdOf(s);
    if (id) byId.set(id, s);
  }

  const body = (id: string) => {
    const s = byId.get(id);
    if (!s) return '';
    const t = typeof s.text === 'string' ? s.text : '';
    const b = bulletsToText(Array.isArray(s.bullets) ? (s.bullets as string[]) : undefined);
    return joinText([t, b]);
  };

  const summary = joinText([body('connection_structure'), body('ensemble_framing'), body('relational_field')]);

  const support = joinText([body('signatures'), body('significance')]);

  const tension = joinText([body('interaction_map'), body('field_distribution'), body('contradiction_map')]);

  const activation = joinText([body('relational_weather_v1')]);

  const whatToDo = joinText([body('synthesis_a'), body('synthesis_b')]);

  const audio = joinText([body('musical'), body('audio_staging'), body('audio_thread'), body('music_translation')]);

  const slots: Record<ExpandedSlotId, string> = {
    summary: stripReadingPresentationNoise(summary),
    support: stripReadingPresentationNoise(support),
    tension: stripReadingPresentationNoise(tension),
    activation: stripReadingPresentationNoise(activation),
    whatToDo: stripReadingPresentationNoise(whatToDo),
    audio: stripReadingPresentationNoise(audio),
  };

  return slots;
}

/** Legacy short/long text when no structured sections — minimal slot fill without inventing prose. */
export function slotsFromLegacyArtifactText(artifact: Record<string, unknown>): Record<ExpandedSlotId, string> {
  const raw = artifact.text;
  let short = '';
  let long = '';
  if (typeof raw === 'string') {
    short = raw;
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as { short?: unknown; long?: unknown };
    short = typeof o.short === 'string' ? o.short : '';
    long = typeof o.long === 'string' ? o.long : '';
  }
  const blob = joinText([short, long]);
  const cleaned = stripReadingPresentationNoise(blob);
  return {
    summary: cleaned,
    support: '',
    tension: '',
    activation: '',
    whatToDo: '',
    audio: '',
  };
}

export function buildExpandedSlotsForArtifact(artifact: Record<string, unknown>): Record<ExpandedSlotId, string> {
  const sections = extractSectionsFromArtifact(artifact);
  if (sections.length === 0) return slotsFromLegacyArtifactText(artifact);
  return mapSectionsToExpandedSlots(sections);
}
