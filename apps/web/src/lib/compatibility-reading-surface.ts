/**
 * Shared helpers for compatibility POST/GET payloads: explanation.sections vs compatibilityText.
 * Invariant: successful compatibility compose always yields at least one readable surface.
 *
 * Detection only: does not generate, rewrite, interpret, or transform narrative meaning.
 */

export type ExplanationLike = {
  sections?: Array<{ title?: string; text?: string; bullets?: string[] }>;
} | null;

export type CompatibilityTextLike =
  | string
  | { short?: string; long?: string; bullets?: string[] }
  | undefined;

export function hasCompatibilityReadingSurface(
  explanation: ExplanationLike,
  compatibilityText: CompatibilityTextLike,
): boolean {
  const sections = explanation?.sections;
  if (Array.isArray(sections) && sections.length > 0) {
    const anySectionContent = sections.some(
      (s) =>
        (typeof s.text === 'string' && s.text.trim().length > 0) ||
        (Array.isArray(s.bullets) && s.bullets.some((b) => String(b).trim().length > 0)),
    );
    if (anySectionContent) return true;
  }
  if (typeof compatibilityText === 'string' && compatibilityText.trim().length > 0) return true;
  if (compatibilityText && typeof compatibilityText === 'object') {
    const short = compatibilityText.short ?? '';
    const long = compatibilityText.long ?? '';
    if (String(short).trim().length > 0 || String(long).trim().length > 0) return true;
    const bullets = compatibilityText.bullets;
    if (Array.isArray(bullets) && bullets.some((b) => String(b).trim().length > 0)) return true;
  }
  return false;
}
