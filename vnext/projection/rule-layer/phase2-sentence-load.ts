/**
 * Phase 2 — deterministic sentence load counting, split helpers, assembly invariants.
 * Priority order is fixed; do not reorder without spec update.
 */

import type { ProjectedExplanationSection, TaggedParagraph, TaggedSectionBody, TaggedSentence } from '../projection-types';
import {
  mergeTaggedSectionBodiesVertical,
  reconstructTaggedSectionBody,
  taggedSectionBodyFromText,
} from '../tagged-text';
import type { ProjectionSurface } from '../projection-types';
import type { TemporalVoiceBucket } from './temporal-classify';
import type { TemplateContext } from './template-lines';

export class Phase2AssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Phase2AssemblyError';
  }
}

export type LoadProvenance =
  | 'template'
  | 'claim_body'
  | 'preface'
  | 'tier_scaffold'
  | 'synthesis_wrapper'
  | 'padding';

const CLAIM_GLUE_RE =
  /\b(In the same picture,|Alongside that signal,|Taken together with the prior emphasis,)\b/;

/**
 * Anchor stems (priority 1).
 * FINAL LOCK: `\bThis connection\b` is relational_framing only, never anchor (handled in relational pass).
 */
const ANCHOR_RES: RegExp[] = [
  /In this chart, you see/,
  /For this connection, you see/,
  /For this group, you see/,
  /In this scenario, you see/,
  /In this chart, you,/,
  /For this connection, you,/,
  /For this group, you,/,
  /In this scenario, you,/,
  /For this ensemble, you,/,
  /For this pair, you,/,
  /Here, you,/,
  /you, in this picture, at baseline/i,
  /you, for this connection, at baseline/i,
  /you, for this group, at baseline/i,
  /you, in this scenario, at baseline/i,
  /you, on this card, at baseline/i,
  /you, in this overlay, at baseline/i,
  /you, in this lab, at baseline/i,
];

const TEMPORAL_RES: RegExp[] = [
  /\bright now\b/i,
  /\btoday\b/i,
  /\bat baseline\b/i,
  /\bin this (moment|beat)\b/i,
  /\b(under fresh pressure|shifting layers|steady and|sparky|livelier layer|mixed steady)\b/i,
  /\b(slower-moving pattern|quick shifts|spike may pass|timescale|near-term|long-haul)\b/i,
  /\b(seasoning|baseline remains|both count)\b/i,
];

const AUDIO_TEMPO = /motion feels (quick and changeable|slow and sustained|moderate and steady)/;
const AUDIO_DENSITY = /the texture feels (tight and crowded|open with room between moments|balances open and full)/;
const AUDIO_TENSION = /listening pressure feels (heavy|light|moderate)/;
const AUDIO_ARC =
  /energy (surges then settles|softens and releases over time|builds and gathers|circles and shifts rather than locking flat)/;

const RELATIONAL_RES: RegExp[] = [
  /\bThis connection\b/,
  /\b(two pictures|two people|pair story|contact feels|between people)\b/i,
  /\b(group|room|ensemble|voices|participants|roster)\b/i,
  /\b(cooperation feels|friction feels|harmony|relational tone)\b/i,
];

const EPISTEMIC_RES: RegExp[] = [
  /\b(stays descriptive|observational|not (a )?verdict)\b/i,
  /\bavoid(s)? (locking|forcing)\b/i,
  /\bMany people find\b/i,
  /\bwithout naming raw numbers\b/i,
  /\bnot a full interpretive report\b/i,
];

const HEADLINE_RE =
  /\b(fire|earth|air|water|balanced)\b.*\b(bright|dark)\b|\b(bright|dark)\b.*\b(fire|earth|air|water|balanced)\b/i;

const STRUCT_AGG_RE = /\b(merged|blend|ensemble|several pictures|dyad|many-voice|wider-room)\b/i;

function stripMatchedSpans(text: string, patterns: RegExp[]): string {
  let t = text;
  for (const p of patterns) {
    t = t.replace(p, ' ');
  }
  return t;
}

export type LoadBreakdown = {
  anchor: 0 | 1;
  temporal: 0 | 1;
  audioFamilies: Set<'tempo' | 'density' | 'tension' | 'arc'>;
  relational: 0 | 1;
  epistemic: 0 | 1;
  headline: 0 | 1;
  structuralAggregate: 0 | 1;
};

export function countSentenceLoads(sentence: string, provenance: LoadProvenance): LoadBreakdown {
  const out: LoadBreakdown = {
    anchor: 0,
    temporal: 0,
    audioFamilies: new Set(),
    relational: 0,
    epistemic: 0,
    headline: 0,
    structuralAggregate: 0,
  };

  if (provenance === 'claim_body') {
    return out;
  }

  const orig = sentence;
  let work = sentence;

  // Priority 1 — anchor
  for (const p of ANCHOR_RES) {
    if (p.test(work)) {
      out.anchor = 1;
      work = work.replace(p, ' ');
      break;
    }
  }

  // Priority 2 — temporal on remainder
  for (const p of TEMPORAL_RES) {
    if (p.test(work)) {
      out.temporal = 1;
      work = work.replace(p, ' ');
      break;
    }
  }

  // Priority 3 — audio families (each family at most once; scan original sentence)
  if (AUDIO_TEMPO.test(orig)) out.audioFamilies.add('tempo');
  if (AUDIO_DENSITY.test(orig)) out.audioFamilies.add('density');
  if (AUDIO_TENSION.test(orig)) out.audioFamilies.add('tension');
  if (AUDIO_ARC.test(orig)) out.audioFamilies.add('arc');

  // Priority 4 — relational (FINAL LOCK: "This connection" is relational only, not anchor)
  for (const p of RELATIONAL_RES) {
    if (p.test(work)) {
      out.relational = 1;
      work = work.replace(p, ' ');
      break;
    }
  }

  for (const p of EPISTEMIC_RES) {
    if (p.test(work)) {
      out.epistemic = 1;
      work = work.replace(p, ' ');
      break;
    }
  }

  if (HEADLINE_RE.test(orig)) {
    out.headline = 1;
  }
  if (STRUCT_AGG_RE.test(orig)) {
    out.structuralAggregate = 1;
  }

  return out;
}

export function totalLoadScore(b: LoadBreakdown): number {
  return (
    b.anchor +
    b.temporal +
    b.audioFamilies.size +
    b.relational +
    b.epistemic +
    b.headline +
    b.structuralAggregate
  );
}

export function splitSentenceForPhase2(sentence: string): string[] {
  const s = sentence.trim();
  if (!s) return [];
  if (s.includes('; ')) {
    const parts = s.split('; ').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((p) => (p.endsWith('.') || p.endsWith('!') || p.endsWith('?') ? p : `${p}.`));
    }
  }
  const m = s.match(/, and (what|the|keep|treat)\b/i);
  if (m && m.index != null && m.index > 0) {
    const a = s.slice(0, m.index).trim();
    const b = s.slice(m.index + 1).trim();
    return [a.endsWith('.') ? a : `${a}.`, b.endsWith('.') ? b : `${b}.`];
  }
  const audioSplit = s.split(/; (?=motion feels|the texture feels|listening pressure|energy )/);
  if (audioSplit.length > 1) {
    return audioSplit.map((p) => p.trim()).filter(Boolean).map((p) => (p.match(/[.!?]$/) ? p : `${p}.`));
  }
  const commas = [...s.matchAll(/, /g)].map((x) => x.index ?? 0);
  for (let i = 0; i < commas.length; i++) {
    const idx = commas[i];
    const left = s.slice(0, idx).trim();
    const right = s.slice(idx + 2).trim();
    if (!left || !right) continue;
    const L = totalLoadScore(countSentenceLoads(left, 'template'));
    const R = totalLoadScore(countSentenceLoads(right, 'template'));
    if (L <= 2 && R <= 2) {
      return [left.endsWith('.') ? left : `${left}.`, right.endsWith('.') ? right : `${right}.`];
    }
  }
  return [s];
}

export function enforceSentenceLoadCap(
  sentence: string,
  provenance: LoadProvenance,
  context: string
): string {
  if (provenance === 'claim_body') return sentence;
  let parts = [sentence.trim()].filter(Boolean);
  let guard = 0;
  while (guard++ < 12) {
    const next: string[] = [];
    let changed = false;
    for (const p of parts) {
      const t = totalLoadScore(countSentenceLoads(p, provenance));
      if (t <= 2) {
        next.push(p);
        continue;
      }
      const split = splitSentenceForPhase2(p);
      if (split.length === 1 && split[0] === p) {
        if (process.env.CI === 'true') {
          throw new Phase2AssemblyError(
            `[Phase2] split failed for sentence (load>2): ${context} :: ${p.slice(0, 200)}`
          );
        }
        next.push(p);
        continue;
      }
      changed = true;
      next.push(...split);
    }
    parts = next;
    if (!changed) break;
    const allOk = parts.every((p) => totalLoadScore(countSentenceLoads(p, provenance)) <= 2);
    if (allOk) return parts.join(' ');
  }
  const bad = parts.find((p) => totalLoadScore(countSentenceLoads(p, provenance)) > 2);
  if (bad && process.env.CI === 'true') {
    throw new Phase2AssemblyError(`[Phase2] could not reduce loads: ${context} :: ${bad.slice(0, 200)}`);
  }
  return parts.join(' ');
}

/**
 * Same end state as `enforceSentenceLoadCap` but returns fragment strings (space-join == cap result).
 * Used for Phase 3 provenance propagation through Phase 2 repair.
 */
export function enforceSentenceLoadCapAsParts(
  sentence: string,
  provenance: LoadProvenance,
  context: string
): string[] {
  if (provenance === 'claim_body') return [sentence];
  let parts = [sentence.trim()].filter(Boolean);
  let guard = 0;
  while (guard++ < 12) {
    const next: string[] = [];
    let changed = false;
    for (const p of parts) {
      const t = totalLoadScore(countSentenceLoads(p, provenance));
      if (t <= 2) {
        next.push(p);
        continue;
      }
      const split = splitSentenceForPhase2(p);
      if (split.length === 1 && split[0] === p) {
        if (process.env.CI === 'true') {
          throw new Phase2AssemblyError(
            `[Phase2] split failed for sentence (load>2): ${context} :: ${p.slice(0, 200)}`
          );
        }
        next.push(p);
        continue;
      }
      changed = true;
      next.push(...split);
    }
    parts = next;
    if (!changed) break;
    const allOk = parts.every((p) => totalLoadScore(countSentenceLoads(p, provenance)) <= 2);
    if (allOk) return parts;
  }
  const bad = parts.find((p) => totalLoadScore(countSentenceLoads(p, provenance)) > 2);
  if (bad && process.env.CI === 'true') {
    throw new Phase2AssemblyError(`[Phase2] could not reduce loads: ${context} :: ${bad.slice(0, 200)}`);
  }
  return parts;
}

function cloneSent(s: TaggedSentence): TaggedSentence {
  return {
    text: s.text,
    provenance: s.provenance,
    ...(s.contentProvenance !== undefined ? { contentProvenance: s.contentProvenance } : {}),
  };
}

/** Mirror `repairPhase2ParagraphLoads` on tagged structure (no string inference). */
export function repairTaggedPhase2ParagraphLoads(
  tagged: TaggedSectionBody,
  provenance: LoadProvenance,
  label: string
): TaggedSectionBody {
  const paragraphs: TaggedParagraph[] = tagged.paragraphs.map((tp, pi) => {
    const outSents: TaggedSentence[] = [];
    for (let si = 0; si < tp.sentences.length; si++) {
      const row = tp.sentences[si]!;
      const frags = enforceSentenceLoadCapAsParts(row.text, provenance, `${label}:p${pi}:s${si}`);
      for (const frag of frags) {
        outSents.push(cloneSent({ ...row, text: frag }));
      }
    }
    return { sentences: outSents };
  });
  const bulletBlocks = tagged.bulletBlocks?.map((bb, bi) =>
    repairTaggedPhase2ParagraphLoads(bb, provenance, `${label}:b${bi}`)
  );
  return { paragraphs, bulletBlocks };
}

/** No claim glue in the same sentence as anchor stems (FINAL LOCK: template/claim boundary). */
export function assertNoClaimAnchorSameSentence(fullText: string, context: string): void {
  const sentences = fullText
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  for (const sent of sentences) {
    const glue = CLAIM_GLUE_RE.test(sent);
    if (!glue) continue;
    for (const ar of ANCHOR_RES) {
      if (ar.test(sent)) {
        throw new Phase2AssemblyError(
          `[Phase2] claim glue and anchor in same sentence (${context}): ${sent.slice(0, 240)}`
        );
      }
    }
  }
}

const REDUCED_PAD = [
  'The same emphasis may read louder under stress and softer under safety.',
  'The feel is often situational when life load changes week to week.',
  'Small experiments usually beat a single decisive relabeling.',
];

export function reducedPadPool(): string[] {
  return REDUCED_PAD;
}

export function injectAnchorPrefix(ctx: TemplateContext): string {
  const surf: ProjectionSurface = ctx.surface ?? 'profile';
  if (ctx.suppressAstrologyTitles) {
    if (ctx.temporalBucket === 'activated') return 'In this scenario, you see fresh pressure right now.';
    if (ctx.temporalBucket === 'mixed') return 'In this scenario, you see steady and shifting layers in this beat.';
    return 'In this scenario, you see a stable story beat.';
  }
  if (surf === 'group') {
    if (ctx.temporalBucket === 'activated') return 'For this group, you see an activated moment.';
    if (ctx.temporalBucket === 'mixed') return 'For this group, you see mixed steady and active layers today.';
    return 'For this group, you see a baseline room.';
  }
  if (surf === 'compat_pair') {
    if (ctx.temporalBucket === 'activated') return 'For this connection, you see heightened contact right now.';
    if (ctx.temporalBucket === 'mixed') return 'For this connection, you see steady and sparky layers today.';
    return 'For this connection, you see a baseline contact tone.';
  }
  if (ctx.temporalBucket === 'activated') return 'In this chart, you see today’s sky leaning in.';
  if (ctx.temporalBucket === 'mixed')
    return 'In this chart, you see a livelier layer on top of your usual baseline today.';
  return 'In this chart, you see a baseline personal picture.';
}

/** Section ids that receive assembler-injected anchor before template body. */
export const PHASE2_ANCHORED_SECTION_IDS = new Set<string>([
  'signatures',
  'significance',
  'musical',
  'sky_summary',
  'personal_emphasis',
  'likely_expressions',
  'watch_fors',
  'integration_prompt',
  'music_translation',
  'relational_weather_v1',
]);

const FORBIDDEN_TEMPLATE_ANCHOR =
  /(In this chart, you,|For this connection, you,|For this group, you,|In this scenario, you,|For this ensemble, you,|For this pair, you,|Here, you,)/;

export function assertTemplateHasNoLegacyAnchor(text: string, where: string): void {
  if (FORBIDDEN_TEMPLATE_ANCHOR.test(text)) {
    throw new Phase2AssemblyError(`[Phase2] template must not contain legacy anchor (${where})`);
  }
}

export function applyAnchorAndTemporalToSectionBody(
  sectionId: string,
  templateBody: string,
  ctx: TemplateContext,
  seed: string,
  temporalLine: string | null
): string {
  assertTemplateHasNoLegacyAnchor(templateBody, sectionId);
  if (!PHASE2_ANCHORED_SECTION_IDS.has(sectionId)) {
    return templateBody;
  }
  const anchor = injectAnchorPrefix(ctx);
  const parts = [anchor, temporalLine?.trim() || '', templateBody.trim()].filter(Boolean);
  return parts.join('\n\n');
}

/** Phase 3 — mirror `applyAnchorAndTemporalToSectionBody` on tagged template body. */
export function applyAnchorAndTemporalToTaggedSection(
  sectionId: string,
  templateTagged: TaggedSectionBody,
  ctx: TemplateContext,
  temporalLine: string | null
): TaggedSectionBody {
  assertTemplateHasNoLegacyAnchor(reconstructTaggedSectionBody(templateTagged), sectionId);
  if (!PHASE2_ANCHORED_SECTION_IDS.has(sectionId)) {
    return templateTagged;
  }
  const anchor = injectAnchorPrefix(ctx);
  let acc = taggedSectionBodyFromText(anchor, 'assembler_glue');
  if (temporalLine?.trim()) {
    acc = mergeTaggedSectionBodiesVertical(acc, taggedSectionBodyFromText(temporalLine.trim(), 'template'));
  }
  const bodyTrim = reconstructTaggedSectionBody(templateTagged).trim();
  if (bodyTrim.length) {
    acc = mergeTaggedSectionBodiesVertical(acc, templateTagged);
  }
  return acc;
}

/** Sections whose first paragraph may be claim-only (glue allowed). */
const SKIP_FIRST_PARA_GLUE = new Set([
  'feed_signal',
  'feed_context',
  'pressure_response',
  'synthesis_a',
  'synthesis_b',
  'contradiction_map',
]);

export function validatePhase2Sections(sections: ProjectedExplanationSection[], seed: string): void {
  for (const sec of sections) {
    const full = [sec.text, ...(sec.bullets ?? [])].join('\n');
    assertNoClaimAnchorSameSentence(full, `${sec.id}:${seed}`);
    if (sec.id === 'audio_staging') continue;
    const paras = sec.text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    const first = paras[0] ?? '';
    if (!SKIP_FIRST_PARA_GLUE.has(sec.id) && CLAIM_GLUE_RE.test(first)) {
      throw new Phase2AssemblyError(`[Phase2] claim glue in first paragraph (${sec.id})`);
    }
    for (const sent of sec.text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)) {
      const t = totalLoadScore(countSentenceLoads(sent, 'template'));
      if (t > 2) {
        throw new Phase2AssemblyError(`[Phase2] load>2 on section ${sec.id}: ${sent.slice(0, 220)}`);
      }
    }
  }
}

export function wrapperRepetitionMetric(text: string): number {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return 0;
  const re =
    /\b(in this picture|at baseline|for this connection, you|for this group, you)\b/i;
  let hit = 0;
  for (const s of sentences) {
    if (re.test(s)) hit++;
  }
  return hit / sentences.length;
}

export function audioDuplicationFamilies(text: string, excludeAudioStaging: boolean): Record<string, number> {
  if (excludeAudioStaging) {
    // caller strips audio_staging sections
  }
  const fams: Record<string, number> = { tempo: 0, density: 0, tension: 0, arc: 0 };
  if (AUDIO_TEMPO.test(text)) fams.tempo++;
  if (AUDIO_DENSITY.test(text)) fams.density++;
  if (AUDIO_TENSION.test(text)) fams.tension++;
  if (AUDIO_ARC.test(text)) fams.arc++;
  return fams;
}

export function repairPhase2ParagraphLoads(
  body: string,
  provenance: LoadProvenance,
  label: string
): string {
  return body
    .split(/\n\n+/)
    .map((para) =>
      para
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => enforceSentenceLoadCap(s, provenance, `${label}:${s.slice(0, 48)}`))
        .join(' ')
    )
    .join('\n\n');
}

export function sentenceLengthStats(text: string): { avgWords: number; longRatio: number } {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return { avgWords: 0, longRatio: 0 };
  const words = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const avgWords = words.reduce((a, b) => a + b, 0) / sentences.length;
  const longRatio = words.filter((w) => w > 35).length / sentences.length;
  return { avgWords, longRatio };
}
