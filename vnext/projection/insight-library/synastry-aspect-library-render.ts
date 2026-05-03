/**
 * Synastry MEP aspect-library body composition — shared by assemble-sections and audit tooling.
 * Must stay aligned with compat_pair / group branch in assemblePhaseDSections.
 *
 * Selection rule: when an AspectInsight carries synastry-frame fields
 * (core_synastry, behavioral_synastry, friendship_synastry, romantic_synastry),
 * those are preferred field-by-field over the natal-frame counterparts. Missing
 * synastry fields fall back to the natal field of the same role. This allows
 * incremental rollout of synastry content without breaking single-chart surfaces
 * (which never reach this compose path) or partially-authored entries.
 */
import type { AspectInsight } from './insight-library-types';

export type SynastryRelationalVariant = 'friendship' | 'romantic';

/**
 * Same string as `assemble-sections.ts` MEP slice for `compat_pair` / `group`:
 * core + behavioral + (friendship | romantic), space-joined.
 *
 * Reads synastry-frame fields when present, falls back to natal-frame fields
 * otherwise. The kill-list mechanism in aspect-library-kill-list.ts continues
 * to suppress entries whose synastry content is not yet authored or has not
 * passed re-audit.
 */
export function composeSynastryMepAspectParagraph(
  ins: AspectInsight,
  variant: SynastryRelationalVariant
): string {
  const core = ins.core_synastry ?? ins.core;
  const behavioral = ins.behavioral_synastry ?? ins.behavioral;
  const rel = variant === 'romantic'
    ? (ins.romantic_synastry ?? ins.romantic)
    : (ins.friendship_synastry ?? ins.friendship);
  return [core, behavioral, rel].filter(Boolean).join(' ');
}
