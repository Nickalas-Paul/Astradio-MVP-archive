/**
 * Synastry MEP aspect-library body composition , shared by assemble-sections and audit tooling.
 * Connection readings (compat_pair): one core_synastry paragraph per hit for scannable length.
 * Group surfaces still call this helper; only core_synastry (fallback core) is emitted.
 */
import type { AspectInsight } from './insight-library-types';

export type SynastryRelationalVariant = 'friendship' | 'romantic';

/**
 * Single focused synastry paragraph per aspect (core_synastry, else core).
 * behavioral_synastry and friendship/romantic variant fields are omitted for connection readability.
 */
export function composeSynastryMepAspectParagraph(
  ins: AspectInsight,
  _variant?: SynastryRelationalVariant
): string {
  void _variant;
  const core = ins.core_synastry ?? ins.core ?? '';
  return String(core).trim();
}
