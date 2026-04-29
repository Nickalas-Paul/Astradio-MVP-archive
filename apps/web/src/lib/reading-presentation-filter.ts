/**
 * Presentation-only cleanup for reading text. Removes scaffolding; does not generate copy.
 */

import { joinParagraphs, splitParagraphIntoSentences, splitParagraphs } from './sentence-enforcement-utils';

/** Substrings (lowercase scan) forbidden inside a sentence. */
export const SYSTEM_LANGUAGE_SENTENCE_FORBIDDEN: readonly string[] = [
  // User-requested scaffolding + established product suppressions
  'the sections stay',
  'sections stay observational',
  'sections stay descriptive',
  'this reading',
  'this read',
  'this card',
  'reading encodes',
  'at the mechanism layer',
  'mechanism layer',
  'interaction type',
  'direction:',
  'dominant signal',
  'low-coupling',
  'coordination light',
  'relational weather',
  'expanded pass',
  'second pass',
  'sandbox framing',
  'this card stays narrow by design',
  'this read weaves',
  '(structural)',
  'activation profile',
  'interaction_map',
  'synthesis_a',
  'synthesis_b',
  'relational field (structural)',
  'directional pressure',
] as const;

function normalizeForScan(s: string): string {
  return s.toLowerCase();
}

const LABEL_STRIP_PATTERNS: RegExp[] = [
  /\bdominant signal:\s*/gi,
  /\binteraction type:\s*/gi,
  /\bdirection:\s*/gi,
  /\bdomain:\s*/gi,
  /\bmechanism:\s*/gi,
  /\bat the mechanism layer,?\s*/gi,
];

/**
 * Removes leading system labels (compose / legacy blobs) while keeping sentence bodies.
 */
export function stripPresentationScaffoldingLabels(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let s = text;
  for (const re of LABEL_STRIP_PATTERNS) {
    s = s.replace(re, '');
  }
  return s.replace(/\s{2,}/g, ' ').trim();
}

function sentencePassesSystemScan(sentence: string): boolean {
  const low = normalizeForScan(sentence);
  if (!low.trim()) return false;
  for (const f of SYSTEM_LANGUAGE_SENTENCE_FORBIDDEN) {
    if (low.includes(f)) return false;
  }
  /** Whole-line scaffolding only containing rubric remnants */
  if (/^\s*sections\s+stay\s+/i.test(sentence.trim()) && /^sections\s+stay\b/i.test(low)) return false;
  return true;
}

/**
 * Label strip + sentence deletion for scaffold / meta language. Empty paragraphs are dropped.
 */
export function applyReadingPresentationPolicies(text: string): string {
  if (!text || typeof text !== 'string') return text;
  const t = stripPresentationScaffoldingLabels(text);
  const paragraphs = splitParagraphs(t);
  const outParas: string[] = [];

  for (const para of paragraphs) {
    const sentences = splitParagraphIntoSentences(para);
    const keptSents = sentences
      .map((s) => stripPresentationScaffoldingLabels(s).trim())
      .filter(Boolean)
      .filter(sentencePassesSystemScan);
    if (keptSents.length > 0) outParas.push(keptSents.join(' '));
  }

  return joinParagraphs(outParas).trim();
}

/**
 * Paragraph-level scaffolding removal (backward compatible name).
 */
export function stripReadingPresentationNoise(text: string): string {
  return applyReadingPresentationPolicies(text);
}
