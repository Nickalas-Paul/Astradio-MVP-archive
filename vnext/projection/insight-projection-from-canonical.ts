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
  | 'snapshotAspects'
  | 'snapshot'
  | 'secondarySnapshot'
  | 'relationalWeatherThemes'
  | 'pairInteractionAspects'
  | 'synastry_context'
  | 'pairInteractionAspectsV2'
  | 'comparisonSeekerContextV1'
> {
  const seekerCtx = canonicalReport.comparison_seeker_context_v1;
  const anchorIdx = canonicalReport.anchor_slot_index ?? 0;
  const anchorParticipant = canonicalReport.participants[anchorIdx] ?? canonicalReport.participants[0];
  /** Phase 6C — when seeker context exists, "your" chart = seeker slot (not lexical-low anchor). */
  const seekerParticipant =
    seekerCtx != null && canonicalReport.participants.length > seekerCtx.seekerSlotIndex
      ? canonicalReport.participants[seekerCtx.seekerSlotIndex]
      : anchorParticipant;
  const targetParticipant =
    seekerCtx != null && canonicalReport.participants.length > seekerCtx.targetSlotIndex
      ? canonicalReport.participants[seekerCtx.targetSlotIndex]
      : undefined;
  const snapshotAspects = seekerParticipant?.natal_snapshot?.aspects ?? [];
  const snapshot = seekerParticipant?.natal_snapshot ?? undefined;
  const secondarySnapshot =
    seekerCtx != null && targetParticipant
      ? targetParticipant.natal_snapshot ?? undefined
      : canonicalReport.participants.length >= 2
        ? canonicalReport.participants[(anchorIdx + 1) % canonicalReport.participants.length]?.natal_snapshot
        : undefined;
  const relationalWeatherThemes = canonicalReport.relational_weather?.themes?.dominantThemes ?? [];

  const syn = canonicalReport.pair_interaction_aspects;
  const synV2 = canonicalReport.pair_interaction_aspects_v2;
  const multi = canonicalReport.participants.length >= 2;

  const phase6cExtras = {
    ...(synV2 != null ? { pairInteractionAspectsV2: synV2 } : {}),
    ...(seekerCtx != null ? { comparisonSeekerContextV1: seekerCtx } : {}),
  };

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
      snapshot,
      secondarySnapshot: secondarySnapshot ?? undefined,
      relationalWeatherThemes,
      pairInteractionAspects: syn,
      synastry_context,
      ...phase6cExtras,
    };
  }

  return {
    snapshotAspects,
    snapshot,
    secondarySnapshot: secondarySnapshot ?? undefined,
    relationalWeatherThemes,
    ...phase6cExtras,
  };
}
