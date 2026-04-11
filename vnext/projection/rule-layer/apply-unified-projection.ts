/**
 * Unified projection orchestrator — single authority for execution order:
 * 1. normalize input → 2. topology → 3. temporal → 4. claim selection (in assemble) →
 * 5. synthesis (in assemble) → 6. audio lexicon (templates + staging) → 7. surface modulation →
 * 8. assemble-sections → 9. tone pass → 10. validation.
 *
 * Do not import this from route handlers; use projectTextFromSemanticCore facade only.
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { ProjectionOptions, ProjectedExplanationSection } from '../projection-types';
import { normalizeProjectionInput } from './normalize-input';
import { classifyTopology } from './topology-classify';
import { classifyTemporalVoice } from './temporal-classify';
import type { TemplateContext } from './template-lines';
import { buildEmphasisRawSections, assemblePhaseDSections } from './assemble-sections';
import { runTonePassOnSections } from './tone-pass';
import { collapseRepetitionPhase0 } from './repetition-collapse-phase0';
import { validateReportSections, buildFinalProjectionValidation } from './validate-projection';
import { validatePhase2Sections } from './phase2-sentence-load';

/**
 * Full projection: Phase D by default; set options.phaseD === false for raw template-only output (no tone/validation).
 */
export function applyUnifiedProjection(
  core: SemanticCore,
  seed: string,
  options?: ProjectionOptions,
  _retryDepth = 0
): ProjectedExplanationSection[] {
  if (!options || options.phaseD === false) {
    const surface = options?.surface ?? 'profile';
    const ctx: TemplateContext = {
      suppressAstrologyTitles: surface === 'campaign',
      topologyClass: classifyTopology(
        (options ?? {
          surface,
          phaseD: false,
          tier: 'baseline',
        }) as ProjectionOptions
      ),
      temporalBucket: classifyTemporalVoice(core),
      surface,
    };
    return buildEmphasisRawSections(core, seed, ctx);
  }

  const norm = normalizeProjectionInput(core, seed, options);
  const temporalBucket = classifyTemporalVoice(core);

  let sections = assemblePhaseDSections({
    core,
    seed,
    options,
    tierMetaRequested: norm.tierMetaRequested,
    tierEff: norm.tierEff,
    surface: options.surface,
    temporalBucket,
  });

  sections = runTonePassOnSections(sections, core);

  const tierForDensityPhase0 = options.surface === 'feed' ? (options.tier ?? 'baseline') : norm.tierEff;
  const validateTierPhase0 = options.surface === 'feed' ? 'baseline' : norm.tierEff;
  sections = collapseRepetitionPhase0(sections, {
    core,
    seed,
    surface: options.surface,
    validateTier: validateTierPhase0,
    tierForDensity: tierForDensityPhase0,
  });

  if (options.surface === 'feed') {
    validatePhase2Sections(sections, seed);
    const tierRequested = options.tier ?? 'baseline';
    const vr = validateReportSections(sections, 'feed', 'baseline', core, tierRequested);
    const pv = buildFinalProjectionValidation(tierRequested, 'baseline', vr, undefined);
    const last = sections[sections.length - 1];
    sections[sections.length - 1] = {
      ...last,
      meta: { ...last.meta, projection_validation: pv },
    };
    return sections;
  }

  validatePhase2Sections(sections, seed);

  const validationResult = validateReportSections(sections, options.surface, norm.tierEff, core, norm.tierEff);

  if (!validationResult.ok && norm.tierEff !== 'baseline' && _retryDepth < 1) {
    return applyUnifiedProjection(
      core,
      seed,
      {
        ...options,
        tier: 'baseline',
        originalTierRequested: norm.tierMetaRequested,
        _priorAttemptViolations: [...validationResult.violations],
      },
      _retryDepth + 1
    );
  }

  const projectionValidation = buildFinalProjectionValidation(
    norm.tierMetaRequested,
    norm.tierEff,
    validationResult,
    options._priorAttemptViolations
  );
  const last = sections[sections.length - 1];
  sections[sections.length - 1] = {
    ...last,
    meta: { ...last.meta, projection_validation: projectionValidation },
  };
  return sections;
}
