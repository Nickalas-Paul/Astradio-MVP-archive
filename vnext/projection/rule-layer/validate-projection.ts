/**
 * Step 10 — projection validation (density, section counts, feed caps).
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { ExpansionTier, ProjectionSurface, ProjectionValidation } from '../projection-types';
import { SURFACE_SCHEMAS } from '../surface-schemas';
import { validateDensity, densityForSurfaceBaseline } from '../density-validate';

export function densityForSectionId(sectionId: string, defaultD: 'short' | 'medium' | 'long'): 'short' | 'medium' | 'long' {
  if (
    /^(audio_|connection_|ensemble_|feed_)/.test(sectionId) ||
    sectionId === 'audio_thread' ||
    sectionId.startsWith('depth_panel_')
  ) {
    return 'short';
  }
  return defaultD;
}

export function validateReportSections(
  sections: import('../projection-types').ProjectedExplanationSection[],
  surface: ProjectionSurface,
  tier: ExpansionTier,
  core: SemanticCore,
  tierForDensity: ExpansionTier
): { ok: boolean; violations: string[] } {
  const schema = SURFACE_SCHEMAS[surface];
  const violations: string[] = [];
  if (sections.length < schema.baselineMinSections) {
    violations.push(`sections:${sections.length}<${schema.baselineMinSections}`);
  }
  if (surface === 'feed' && schema.maxSectionsFeed && sections.length > schema.maxSectionsFeed) {
    violations.push(`feed_sections_overflow`);
  }

  const defaultD = densityForSurfaceBaseline(schema.baselineDensityDefault, tierForDensity);
  for (const sec of sections) {
    const d = densityForSectionId(sec.id, defaultD);
    const claims =
      sec.meta?.claimIdsReferenced && sec.meta.claimIdsReferenced.length > 0
        ? sec.meta.claimIdsReferenced
        : core.claims.slice(0, 8).map((c) => c.claim_id);
    const v = validateDensity(sec.text, d, claims);
    if (!v.ok) violations.push(`${sec.id}:${v.reasons.join(';')}`);
  }

  return { ok: violations.length === 0, violations };
}

export function buildFinalProjectionValidation(
  tierRequested: ExpansionTier,
  tierEffective: ExpansionTier,
  validateResult: { ok: boolean; violations: string[] },
  priorAttemptViolations?: string[]
): ProjectionValidation {
  const downgraded =
    tierRequested !== 'baseline' &&
    tierEffective === 'baseline' &&
    priorAttemptViolations != null &&
    priorAttemptViolations.length > 0;
  const out: ProjectionValidation = {
    ok: validateResult.ok,
    tierRequested,
    tierEffective,
    violations: validateResult.violations,
  };
  if (downgraded) {
    out.downgradedFrom = tierRequested;
    out.prior_attempt_violations = [...priorAttemptViolations!];
  }
  return out;
}
