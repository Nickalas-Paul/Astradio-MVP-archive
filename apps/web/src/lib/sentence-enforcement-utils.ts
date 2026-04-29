/**
 * Deterministic helpers for relational reading presentation enforcement.
 */

/** First N words for opening-phrase repetition caps (relational reading enforcement). */
const OPENING_PHRASE_WORDS = 5;
const MAX_SAME_OPENING_SENTENCES_PER_ARTIFACT = 2;

/** @deprecated Use OPENING_PHRASE_WORDS / openingPhraseKeyFiveWords for new enforcement */
const WORDS_FOR_PREFIX = OPENING_PHRASE_WORDS;

function collapseWhitespaceLower(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Strips trailing sentence punctuation for identity comparison only. */
export function comparableSentenceFingerprint(sentence: string): string {
  const c = collapseWhitespaceLower(sentence);
  return c.replace(/[.!?…]+$/u, '').trim();
}

function wordsSlice(sentence: string, count: number): string[] {
  const cleaned = comparableSentenceFingerprint(sentence);
  if (!cleaned) return [];
  return cleaned.split(/\s+/).filter(Boolean).slice(0, Math.max(count, 0));
}

/**
 * Normalizes first WORDS_FOR_PREFIX meaningful words after comparable fingerprinting.
 */
export function openingSentencePrefixKey(sentence: string): string {
  const w = wordsSlice(sentence, WORDS_FOR_PREFIX);
  return w.join(' ');
}

/** Normalized first five words for cross-sentence opening repetition limits. */
export function openingPhraseKeyFiveWords(sentence: string): string {
  const w = wordsSlice(sentence, OPENING_PHRASE_WORDS);
  return w.join(' ');
}

function wordSetForJaccard(sentence: string): Set<string> {
  const fp = comparableSentenceFingerprint(sentence);
  if (!fp) return new Set();
  const parts = fp.split(/\s+/).filter(Boolean);
  return new Set(parts);
}

export function jaccardWordSimilarity(a: string, b: string): number {
  const A = wordSetForJaccard(a);
  const B = wordSetForJaccard(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function sentencesAreNearDuplicate(a: string, b: string, threshold: number): boolean {
  const fa = comparableSentenceFingerprint(a);
  const fb = comparableSentenceFingerprint(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  const ja = jaccardWordSimilarity(a, b);
  if (ja >= threshold) return true;
  return false;
}

/**
 * Split on sentence endings; each visual line yields one or more sentences.
 */
export function splitParagraphIntoSentences(body: string): string[] {
  const t = body.replace(/\r\n/g, '\n').trim();
  if (!t) return [];

  const out: string[] = [];
  for (const line of t.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    /** Lines starting with bullets are kept as atomic units (no splitting on period mid-line). */
    if (/^[•\u2022]\s*/.test(trimmed)) {
      out.push(trimmed.replace(/^[•\u2022]\s*/, '• ').trimEnd());
      continue;
    }
    const chunks = trimmed.split(/(?<=[.!?…])\s+/u).map((x) => x.trim()).filter(Boolean);
    out.push(...chunks);
  }
  return out;
}

/** Per-paragraph splits; preserves paragraph joins with \n\n in output reconstruction. */
export function splitParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
}

export function joinParagraphs(paragraphs: string[]): string {
  return paragraphs.filter((p) => p.trim()).join('\n\n').trim();
}

/**
 * Drops duplicate comparable sentences globally and caps repeated openings (cross-slot order).
 */
export function dedupeComparableSentencesWithOpeningCap(
  slotParagraphBodies: Record<'summary' | 'support' | 'tension' | 'activation' | 'whatToDo', string>
): Record<'summary' | 'support' | 'tension' | 'activation' | 'whatToDo', string> {
  const order: Array<'summary' | 'support' | 'tension' | 'activation' | 'whatToDo'> = [
    'summary',
    'support',
    'tension',
    'activation',
    'whatToDo',
  ];
  const seenFingerprint = new Set<string>();
  const prefixEmissionOrder = new Map<string, number>();

  const rebuilt: Partial<Record<'summary' | 'support' | 'tension' | 'activation' | 'whatToDo', string>> = {};
  for (const slotId of order) {
    const paras = splitParagraphs(slotParagraphBodies[slotId] || '');
    const outParas: string[] = [];

    for (const para of paras) {
      const sentsRaw = splitParagraphIntoSentences(para);
      const kept: string[] = [];
      for (const rawSent of sentsRaw) {
        const trimmed = rawSent.trim();
        if (!trimmed) continue;
        const fp = comparableSentenceFingerprint(trimmed);
        if (!fp) continue;
        if (seenFingerprint.has(fp)) continue;

        const pre = openingSentencePrefixKey(trimmed);
        if (pre.length > 0) {
          const n = prefixEmissionOrder.get(pre) ?? 0;
          /** Allow two sentences with same opening stem; suppress third and subsequent. */
          if (n >= MAX_SAME_OPENING_SENTENCES_PER_ARTIFACT) continue;
          prefixEmissionOrder.set(pre, n + 1);
        }

        seenFingerprint.add(fp);
        kept.push(trimmed);
      }
      if (kept.length) outParas.push(kept.join(' '));
    }
    rebuilt[slotId] = joinParagraphs(outParas);
  }

  return rebuilt as typeof slotParagraphBodies;
}
