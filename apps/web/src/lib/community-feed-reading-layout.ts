/**
 * Maps existing compose/projection section ids to product-facing expanded slots.
 * Presentation only — no generation.
 */

import {
  stripPresentationScaffoldingLabels,
  stripReadingPresentationNoise,
} from './reading-presentation-filter';

export type ExpandedSlotId = 'summary' | 'support' | 'tension' | 'activation' | 'whatToDo' | 'audio';

export const EXPANDED_SLOT_LABELS: Record<ExpandedSlotId, string> = {
  summary: 'Summary',
  support: 'Support',
  tension: 'Tension',
  activation: 'Current Activation',
  whatToDo: 'What To Do',
  audio: 'Audio Translation',
};

type RawSection = { id?: string; sectionId?: string; title?: string; text?: string; bullets?: string[] };

const SUMMARY_IDS = ['connection_structure', 'ensemble_framing', 'relational_field'] as const;
const SUPPORT_IDS = ['signatures', 'significance'] as const;
const TENSION_IDS = ['interaction_map', 'field_distribution', 'contradiction_map'] as const;
const ACTIVATION_IDS = ['relational_weather_v1'] as const;
const AUDIO_IDS = ['musical', 'audio_staging', 'audio_thread', 'music_translation'] as const;

/** Never routed to expanded body (scaffolding / synthesis). */
const EXCLUDED_IDS = new Set<string>(['synthesis_a', 'synthesis_b']);

const ROUTED_IDS = new Set<string>([
  ...SUMMARY_IDS,
  ...SUPPORT_IDS,
  ...TENSION_IDS,
  ...ACTIVATION_IDS,
  ...AUDIO_IDS,
  ...EXCLUDED_IDS,
]);

const FIRST_PARAGRAPH_IDS = new Set<string>(['significance', 'contradiction_map', 'ensemble_framing']);

const DEDUPE_SLOT_ORDER: ExpandedSlotId[] = [
  'summary',
  'support',
  'tension',
  'activation',
  'whatToDo',
  'audio',
];

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

function firstParagraph(text: string): string {
  const t = text.trim();
  const ix = t.indexOf('\n\n');
  if (ix === -1) return t;
  return t.slice(0, ix).trim();
}

function bodyFromSection(s: RawSection, id: string): string {
  const raw = typeof s.text === 'string' ? s.text : '';
  const text = FIRST_PARAGRAPH_IDS.has(id) ? firstParagraph(raw) : raw;
  const b = bulletsToText(Array.isArray(s.bullets) ? (s.bullets as string[]) : undefined);
  return joinText([text, b]);
}

function normalizeParagraph(p: string): string {
  return p.trim().replace(/\s+/g, ' ').toLowerCase();
}

function dedupeParagraphsAcrossSlots(slots: Record<ExpandedSlotId, string>): Record<ExpandedSlotId, string> {
  const seen = new Set<string>();
  const out = { ...slots };
  for (const slotId of DEDUPE_SLOT_ORDER) {
    const raw = out[slotId] || '';
    const paras = raw
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const kept: string[] = [];
    for (const p of paras) {
      const key = normalizeParagraph(p);
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(p);
    }
    out[slotId] = kept.join('\n\n');
  }
  return out;
}

type ActivationScalars = {
  emotional_activation?: number;
  friction?: number;
  harmony?: number;
  intensity?: number;
  communication_emphasis?: number;
  volatility?: number;
  growth_pressure?: number;
};

/** Single deterministic sentence from activation vector (same ranking as collapsed descriptor). */
export function whatToDoSentenceFromWeather(weather: unknown): string {
  if (!weather || typeof weather !== 'object') return '';
  const w = weather as { activation?: ActivationScalars };
  const a = w.activation;
  if (!a || typeof a !== 'object') return '';
  const scores: { k: string; v: number }[] = [
    { k: 'emotional', v: Number(a.emotional_activation) || 0 },
    { k: 'friction', v: Number(a.friction) || 0 },
    { k: 'harmony', v: Number(a.harmony) || 0 },
    { k: 'intensity', v: Number(a.intensity) || 0 },
    { k: 'communication', v: Number(a.communication_emphasis) || 0 },
    { k: 'volatility', v: Number(a.volatility) || 0 },
    { k: 'growth', v: Number(a.growth_pressure) || 0 },
  ];
  scores.sort((x, y) => y.v - x.v || x.k.localeCompare(y.k));
  const top = scores[0]!;
  const TABLE: Record<string, string> = {
    emotional:
      'Name feelings plainly without rehearsing the whole story—short beats matter more than perfect wording today.',
    friction:
      'Slow one notch before replying; pressure eases when intent is explicit and the ask is concrete.',
    harmony:
      'Use the ease between you to pin down one practical next step—comfort can skip the details you still need.',
    intensity:
      'Keep contact steady and specific; intensity spikes when topics stay vague or overly broad.',
    communication:
      'Say the request in one sentence, then listen—clarity matters more than volume or pace.',
    volatility:
      'Pause before matching a sharp turn in tone; reset with one factual check-in before interpreting intent.',
    growth: 'Choose one small adjustment instead of a sweeping overhaul—progress accumulates in inches.',
  };
  return (
    TABLE[top.k] || 'Keep asks concrete and leave room for how the other person responds.'
  );
}

/** Pull sections from compose artifact text blob. */
export function extractSectionsFromArtifact(artifact: Record<string, unknown>): RawSection[] {
  const text = artifact.text;
  if (text && typeof text === 'object' && !Array.isArray(text)) {
    const t = text as Record<string, unknown>;
    const expl = t.explanation as { sections?: RawSection[] } | undefined;
    if (expl?.sections && Array.isArray(expl.sections) && expl.sections.length > 0) return expl.sections;
    const secs = t.sections;
    if (Array.isArray(secs) && secs.length > 0) return secs as RawSection[];
  }
  return [];
}

function buildSectionMap(sections: RawSection[]): Map<string, RawSection> {
  const byId = new Map<string, RawSection>();
  for (const s of sections) {
    const id = sectionIdOf(s);
    if (!id || EXCLUDED_IDS.has(id)) continue;
    byId.set(id, s);
  }
  return byId;
}

function unknownSectionIds(sections: RawSection[]): string[] {
  const ids = new Set<string>();
  for (const s of sections) {
    const id = sectionIdOf(s);
    if (!id || EXCLUDED_IDS.has(id)) continue;
    if (!ROUTED_IDS.has(id)) ids.add(id);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function bodyFrom(byId: Map<string, RawSection>, id: string): string {
  const s = byId.get(id);
  if (!s) return '';
  return bodyFromSection(s, id);
}

/**
 * Assigns known projection ids into expanded slots. Unknown ids → Summary (safe fallback).
 * `synthesis_a` / `synthesis_b` excluded entirely.
 */
export function mapSectionsToExpandedSlots(
  sections: RawSection[],
  weather: unknown
): Record<ExpandedSlotId, string> {
  const byId = buildSectionMap(sections);
  const unknownIds = unknownSectionIds(sections);

  const summary = joinText([
    ...SUMMARY_IDS.map((id) => bodyFrom(byId, id)),
    ...unknownIds.map((id) => bodyFrom(byId, id)),
  ]);

  const support = joinText([...SUPPORT_IDS.map((id) => bodyFrom(byId, id))]);

  const tension = joinText([...TENSION_IDS.map((id) => bodyFrom(byId, id))]);

  const activation = joinText([...ACTIVATION_IDS.map((id) => bodyFrom(byId, id))]);

  const audio = joinText([...AUDIO_IDS.map((id) => bodyFrom(byId, id))]);

  const whatToDo = whatToDoSentenceFromWeather(weather);

  const slots: Record<ExpandedSlotId, string> = {
    summary,
    support,
    tension,
    activation,
    whatToDo,
    audio,
  };

  const labeled: Record<ExpandedSlotId, string> = {
    summary: stripPresentationScaffoldingLabels(slots.summary),
    support: stripPresentationScaffoldingLabels(slots.support),
    tension: stripPresentationScaffoldingLabels(slots.tension),
    activation: stripPresentationScaffoldingLabels(slots.activation),
    whatToDo: stripPresentationScaffoldingLabels(slots.whatToDo),
    audio: stripPresentationScaffoldingLabels(slots.audio),
  };

  return labeled;
}

/** Only `short` (single stripped paragraph). Does not concatenate `long` into Summary. */
export function slotsLegacyMinimalFallback(
  artifact: Record<string, unknown>,
  opts?: { weather?: unknown }
): Record<ExpandedSlotId, string> {
  const raw = artifact.text;
  let short = '';
  if (typeof raw === 'string') {
    short = raw;
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as { short?: unknown };
    short = typeof o.short === 'string' ? o.short : '';
  }

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn('[community-feed-reading-layout] Missing structured sections; minimal short fallback.');
  }

  let summary = stripPresentationScaffoldingLabels(short);
  summary = stripReadingPresentationNoise(summary);
  const firstBlock = summary.split(/\n\n+/)[0]?.trim() ?? summary;

  return {
    summary: firstBlock,
    support: '',
    tension: '',
    activation: '',
    whatToDo: whatToDoSentenceFromWeather(opts?.weather ?? artifact.weather),
    audio: '',
  };
}

export function buildExpandedSlotsForArtifact(
  artifact: Record<string, unknown>,
  opts?: { weather?: unknown }
): Record<ExpandedSlotId, string> {
  const sections = extractSectionsFromArtifact(artifact);
  const weather = opts?.weather ?? artifact.weather;

  if (sections.length === 0) {
    return slotsLegacyMinimalFallback(artifact, { weather });
  }

  let slots = mapSectionsToExpandedSlots(sections, weather);
  slots = dedupeParagraphsAcrossSlots(slots);

  const out: Record<ExpandedSlotId, string> = {
    summary: stripReadingPresentationNoise(slots.summary),
    support: stripReadingPresentationNoise(slots.support),
    tension: stripReadingPresentationNoise(slots.tension),
    activation: stripReadingPresentationNoise(slots.activation),
    whatToDo: stripReadingPresentationNoise(slots.whatToDo),
    audio: stripReadingPresentationNoise(slots.audio),
  };

  return out;
}
