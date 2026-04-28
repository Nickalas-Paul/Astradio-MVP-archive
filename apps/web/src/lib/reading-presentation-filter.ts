/**
 * Soft presentation-only cleanup for reading text. Does not validate or block pipeline output.
 */

const FORBIDDEN_SUBSTRINGS = [
  'this card stays narrow by design',
  'expanded pass',
  'second pass',
  'this read weaves',
  'sections stay descriptive',
  'sandbox framing',
  '(structural)',
  'activation profile',
  'interaction_map',
  'synthesis_a',
  'synthesis_b',
  'relational weather',
  'relational field (structural)',
] as const;

function normalizeForScan(s: string): string {
  return s.toLowerCase();
}

/**
 * Removes sentences/lines that are dominated by forbidden scaffolding phrases.
 * Does not inject replacement copy.
 */
export function stripReadingPresentationNoise(text: string): string {
  if (!text || typeof text !== 'string') return text;
  const paragraphs = text.split(/\n\n+/);
  const outParas: string[] = [];
  for (const para of paragraphs) {
    const lines = para.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const kept: string[] = [];
    for (const line of lines) {
      const low = normalizeForScan(line);
      const bad = FORBIDDEN_SUBSTRINGS.some((f) => low.includes(f));
      if (!bad) kept.push(line);
    }
    if (kept.length > 0) outParas.push(kept.join('\n'));
  }
  return outParas.join('\n\n').trim();
}
