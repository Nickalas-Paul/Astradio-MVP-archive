import type { CanonicalReportObject } from '../canonical/canonical-report-object';
import type { ProjectionOptions } from './projection-types';

/**
 * Fields for insight-library wiring — present on canonical report, not on SemanticCore.
 */
export function insightProjectionOptionsFromCanonical(
  canonicalReport: CanonicalReportObject
): Pick<ProjectionOptions, 'snapshotAspects' | 'relationalWeatherThemes'> {
  const anchorIdx = canonicalReport.anchor_slot_index ?? 0;
  const anchorParticipant = canonicalReport.participants[anchorIdx] ?? canonicalReport.participants[0];
  const snapshotAspects = anchorParticipant?.natal_snapshot?.aspects ?? [];
  const relationalWeatherThemes = canonicalReport.relational_weather?.themes?.dominantThemes ?? [];
  return { snapshotAspects, relationalWeatherThemes };
}
