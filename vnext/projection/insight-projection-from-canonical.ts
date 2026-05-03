import type { CanonicalReportObject } from '../canonical/canonical-report-object';
import type { ProjectionOptions } from './projection-types';

/**
 * Fields for insight-library wiring — present on canonical report, not on SemanticCore.
 *
 * **Synastry (S3 Mode 1+):** When `pair_interaction_aspects` on the canonical report is non-empty,
 * projection receives `pairInteractionAspects` + `synastry_context`. When synastry is empty or only
 * anchor natal applies, see `aspectsForInsightLibraryLookup` in assemble-sections for fallback rules.
 */
export function insightProjectionOptionsFromCanonical(
  canonicalReport: CanonicalReportObject
): Pick<
  ProjectionOptions,
  'snapshotAspects' | 'relationalWeatherThemes' | 'pairInteractionAspects' | 'synastry_context'
> {
  const anchorIdx = canonicalReport.anchor_slot_index ?? 0;
  const anchorParticipant = canonicalReport.participants[anchorIdx] ?? canonicalReport.participants[0];
  const snapshotAspects = anchorParticipant?.natal_snapshot?.aspects ?? [];
  const relationalWeatherThemes = canonicalReport.relational_weather?.themes?.dominantThemes ?? [];

  const syn = canonicalReport.pair_interaction_aspects;
  const multi = canonicalReport.participants.length >= 2;

  /**
   * Populate synastry-driven projection options only when there is at least one cross-chart hit.
   * Empty synastry (`[]` on canonical or omitted): do **not** set `pairInteractionAspects` on options
   * (omit key); assembler falls back to anchor `snapshotAspects` only — no double-render.
   */
  if (multi && syn != null && syn.length > 0) {
    const synastry_context =
      canonicalReport.participants.length > 2 ? 'group_aggregate' : 'pair_comparison';
    return {
      snapshotAspects,
      relationalWeatherThemes,
      pairInteractionAspects: syn,
      synastry_context,
    };
  }

  return { snapshotAspects, relationalWeatherThemes };
}
