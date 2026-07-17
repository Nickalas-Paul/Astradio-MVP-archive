export interface CaptionInput {
  text: string;
  title: string;
  element: string;
  date?: string;
}

const ELEMENT_TAG: Record<string, string> = {
  fire: 'The sky burns bright today.',
  earth: 'The sky is grounded today.',
  air: 'The sky moves fast today.',
  water: 'The sky runs deep today.',
  cosmic: 'The sky speaks today.',
};

const MAX_CAPTION = 300;
const MAX_HOOK = 120;

/** Sanitize hook source text per Astradio content standards. */
export function sanitizeCaptionText(text: string): string {
  let out = text;

  // Em dash → comma; en dash → hyphen
  out = out.replace(/\u2014/g, ',').replace(/—/g, ',');
  out = out.replace(/\u2013/g, '-').replace(/–/g, '-');

  // Collapse "word, , word" leftovers from em-dash replacement
  out = out.replace(/,\s*,+/g, ',');

  // Remove "Listen for" / "Listen to the" constructions
  out = out.replace(/\bListen for\s+/gi, '');
  out = out.replace(/\bListen to the\s+/gi, '');

  // artifact → composition
  out = out.replace(/\bartifact\b/gi, 'composition');

  // Strip banned Generate/Generating/Generation
  out = out.replace(/\bGenerating\b/gi, '');
  out = out.replace(/\bGeneration\b/gi, '');
  out = out.replace(/\bGenerate\b/gi, '');

  // Strip AI-tell transitions
  out = out.replace(/\bhowever,?\s*/gi, '');
  out = out.replace(/\bindeed,?\s*/gi, '');
  out = out.replace(/\bmoreover,?\s*/gi, '');

  // Clean up whitespace left by removals
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();

  // Final pass: no em dashes
  out = out.replace(/\u2014/g, ',').replace(/—/g, ',');

  return out;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return (match ? match[0] : trimmed).trim();
}

function truncateAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const budget = maxChars - 3; // room for "..."
  if (budget <= 0) return '...';
  const slice = text.slice(0, budget);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}...`;
}

function elementTagLine(element: string): string {
  const key = element.trim().toLowerCase();
  return ELEMENT_TAG[key] ?? ELEMENT_TAG.cosmic;
}

function hashtagLine(element: string): string {
  const key = element.trim().toLowerCase() || 'cosmic';
  return `Listen at astradio.io #astrology #astradio #birthchart #todayssky #${key}energy`;
}

function assemble(hook: string, tag: string | null, hashtags: string): string {
  if (tag) return `${hook}\n\n${tag}\n\n${hashtags}`;
  return `${hook}\n\n${hashtags}`;
}

/**
 * Build a TikTok caption under 300 characters with hook, element tag, and hashtags.
 */
export function buildTikTokCaption(input: CaptionInput): string {
  const sanitized = sanitizeCaptionText(input.text || '');
  let hook = truncateAtWord(firstSentence(sanitized), MAX_HOOK);
  // Ensure no em dashes survived in the hook
  hook = hook.replace(/\u2014/g, ',').replace(/—/g, ',');

  const tag = elementTagLine(input.element);
  const hashtags = hashtagLine(input.element);

  let caption = assemble(hook, tag, hashtags);

  if (caption.length > MAX_CAPTION) {
    // Shorten hook first
    const overhead = assemble('', tag, hashtags).length; // "\n\n" + tag + "\n\n" + hashtags
    const hookBudget = Math.max(20, MAX_CAPTION - overhead);
    hook = truncateAtWord(hook, hookBudget);
    caption = assemble(hook, tag, hashtags);
  }

  if (caption.length > MAX_CAPTION) {
    // Drop element tag line
    caption = assemble(hook, null, hashtags);
  }

  if (caption.length > MAX_CAPTION) {
    // Last resort: shrink hook against hashtags-only overhead
    const overhead = assemble('', null, hashtags).length;
    const hookBudget = Math.max(10, MAX_CAPTION - overhead);
    hook = truncateAtWord(hook, hookBudget);
    caption = assemble(hook, null, hashtags);
  }

  // Absolute guard
  if (caption.length > MAX_CAPTION) {
    caption = caption.slice(0, MAX_CAPTION - 3).trimEnd() + '...';
  }

  return caption.replace(/\u2014/g, ',').replace(/—/g, ',');
}
