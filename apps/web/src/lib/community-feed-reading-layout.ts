/**
 * Maps existing compose/projection section ids to product-facing expanded slots.
 * Presentation only — no generation.
 *
 * Final relational enforcement runs in `relational-reading-enforcement.ts` (`finalizeRelationalReadingSurfaces`).
 */

import { stripPresentationScaffoldingLabels } from './reading-presentation-filter';

export type ExpandedSlotId = 'summary' | 'support' | 'tension' | 'activation' | 'whatToDo' | 'audio';

export const EXPANDED_SLOT_LABELS: Record<ExpandedSlotId, string> = {
  summary: 'Summary',
  support: 'Support',
  tension: 'Tension',
  activation: 'Current Activation',
  whatToDo: 'What To Do',
  audio: 'Audio Translation',
};

/** Expanded reading render order including audio (after narrative slots). */
export const EXPANDED_READING_RENDER_ORDER: ExpandedSlotId[] = [
  'summary',
  'support',
  'tension',
  'activation',
  'whatToDo',
  'audio',
];

type RawSection = { id?: string; sectionId?: string; title?: string; text?: string; bullets?: string[] };

const SUMMARY_IDS = ['connection_structure', 'ensemble_framing', 'relational_field'] as const;
const SUPPORT_IDS = ['signatures', 'significance'] as const;
const TENSION_IDS = ['interaction_map', 'field_distribution', 'contradiction_map'] as const;
const ACTIVATION_IDS = ['relational_weather_v1'] as const;
const AUDIO_IDS = ['audio_thread', 'music_translation'] as const;

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

export const DEDUPE_SLOT_ORDER: ExpandedSlotId[] = [
  'summary',
  'support',
  'tension',
  'activation',
  'whatToDo',
  'audio',
];

/** When no compose sections exist, do not surface short+long blob text; leave summary empty unless policy keeps safe fragments. */
const MINIMAL_UNAVAILABLE_SUMMARY_NOTE =
  'Minimal reading state: structured sections were unavailable for this bookmark. Open this connection again to regenerate.';

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

/** Exported for relational reading enforcement — paragraph-level dedupe in slot order. */
export function dedupeParagraphsAcrossExpandedSlots(slots: Record<ExpandedSlotId, string>): Record<ExpandedSlotId, string> {
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

function candidateSections(value: unknown): RawSection[] {
  if (!Array.isArray(value)) return [];
  return (value as RawSection[]).filter((s) => !!s && typeof s === 'object');
}

/** Pull sections from compose artifact text blob or top-level explanation (forecast payloads). */
export function extractSectionsFromArtifact(artifact: Record<string, unknown>): RawSection[] {
  const text = artifact.text;
  const textObj = text && typeof text === 'object' && !Array.isArray(text) ? (text as Record<string, unknown>) : null;
  const textExplanationObj =
    textObj && textObj.explanation && typeof textObj.explanation === 'object' && !Array.isArray(textObj.explanation)
      ? (textObj.explanation as Record<string, unknown>)
      : null;
  const topExpl =
    artifact.explanation && typeof artifact.explanation === 'object' && !Array.isArray(artifact.explanation)
      ? (artifact.explanation as Record<string, unknown>)
      : null;

  const candidates: Array<{ path: 'text.explanation.sections' | 'text.sections' | 'explanation.sections'; sections: RawSection[] }> =
    [
      { path: 'text.explanation.sections', sections: candidateSections(textExplanationObj?.sections) },
      { path: 'text.sections', sections: candidateSections(textObj?.sections) },
      { path: 'explanation.sections', sections: candidateSections(topExpl?.sections) },
    ];

  let best: (typeof candidates)[number] | null = null;
  for (const c of candidates) {
    if (!best || c.sections.length > best.sections.length) {
      best = c;
      continue;
    }
    if (!best) continue;
    if (c.sections.length === best.sections.length) {
      const rank = (p: (typeof candidates)[number]['path']): number => {
        if (p === 'text.explanation.sections') return 0;
        if (p === 'text.sections') return 1;
        return 2;
      };
      if (rank(c.path) < rank(best.path)) best = c;
    }
  }

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    const nonEmpty = candidates.filter((c) => c.sections.length > 0);
    if (nonEmpty.length > 1) {
      // eslint-disable-next-line no-console
      console.debug(
        '[community-feed-reading-layout] Multiple structured section candidates detected.',
        nonEmpty.map((c) => `${c.path}:${c.sections.length}`).join(' | ')
      );
    }
    if ((!best || best.sections.length === 0) && textObj) {
      // eslint-disable-next-line no-console
      console.debug(
        '[community-feed-reading-layout] No structured sections found while artifact.text exists.'
      );
    }
  }

  if (best && best.sections.length > 0) return best.sections;

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

/**
 * When structured sections are missing: only `short` (no long blob). Policy enforcement is applied later by `finalizeRelationalReadingSurfaces`.
 */
export function buildMinimalExpandedSlotsBeforeEnforcement(
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
    const textPresent = artifact.text != null;
    // eslint-disable-next-line no-console
    console.warn(
      `[community-feed-reading-layout] Using minimal fallback (reason=no_structured_sections text_present=${textPresent ? '1' : '0'}).`
    );
  }

  let summary = stripPresentationScaffoldingLabels(short);
  if (!summary.trim()) {
    summary = MINIMAL_UNAVAILABLE_SUMMARY_NOTE;
  }

  return {
    summary,
    support: '',
    tension: '',
    activation: '',
    whatToDo: whatToDoSentenceFromWeather(opts?.weather ?? artifact.weather),
    audio: '',
  };
}
