/**
 * Phase D — structural density validation (projection only).
 */
import type { DensityClass } from './projection-types';

export const DENSITY_RULES: Record<
  DensityClass,
  { minParagraphs: number; minSentencesPerParagraph: number; minClaims: number }
> = {
  /** Phase 2 density contract — aligned with assemble-sections enrichSectionText. */
  short: { minParagraphs: 1, minSentencesPerParagraph: 1, minClaims: 1 },
  medium: { minParagraphs: 1, minSentencesPerParagraph: 2, minClaims: 2 },
  long: { minParagraphs: 2, minSentencesPerParagraph: 2, minClaims: 3 },
};

export function countParagraphs(text: string): number {
  const p = text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  return Math.max(p.length, text.trim() ? 1 : 0);
}

export function countSentences(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const chunks = t.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
  return Math.max(chunks.length, 1);
}

export function minClaimBodiesForDensity(density: DensityClass): number {
  return DENSITY_RULES[density].minClaims;
}

export function validateDensity(
  text: string,
  density: DensityClass,
  claimIdsReferenced: string[],
  opts?: { minClaimsOverride?: number }
): { ok: boolean; reasons: string[] } {
  const r = DENSITY_RULES[density];
  const reasons: string[] = [];
  const paras = text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  const paraCount = paras.length || (text.trim() ? 1 : 0);
  if (paraCount < r.minParagraphs) {
    reasons.push(`paragraphs:${paraCount}<${r.minParagraphs}`);
  }
  const blocks = paras.length ? paras : [text.trim()].filter(Boolean);
  for (let i = 0; i < blocks.length; i++) {
    const sc = countSentences(blocks[i]);
    if (sc < r.minSentencesPerParagraph) {
      reasons.push(`sentences[${i}]:${sc}<${r.minSentencesPerParagraph}`);
    }
  }
  const uniq = new Set(claimIdsReferenced.filter(Boolean));
  const minClaims = opts?.minClaimsOverride ?? r.minClaims;
  if (uniq.size < minClaims) {
    reasons.push(`claims:${uniq.size}<${minClaims}`);
  }
  return { ok: reasons.length === 0, reasons };
}

export function densityForSurfaceBaseline(surfaceDensity: DensityClass, tier: 'baseline' | 'expanded' | 'extended'): DensityClass {
  /** Phase 2: extended tier uses the same density class as expanded for medium-baseline surfaces. */
  if (tier === 'extended' && surfaceDensity === 'medium') return 'medium';
  if (tier === 'expanded' && surfaceDensity === 'medium') return 'medium';
  return surfaceDensity;
}
