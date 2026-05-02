/**
 * TextProjection: deterministic strings from SemanticCore only (no new claims).
 * Public facade — all work delegated to rule-layer/apply-unified-projection.
 */
import type { SemanticCore } from '../semantic/semantic-core';
import type { ProjectionOptions } from './projection-types';
import type { ProjectedExplanationSection } from './projection-types';
import { applyUnifiedProjection } from './rule-layer/apply-unified-projection';

export type { ProjectedExplanationSection };

/**
 * Raw sections from SemanticCore.text emphasis order (template-only; no Phase D).
 * Uses default profile template context for title policy.
 */
export function buildRawProjectedSections(core: SemanticCore, seed: string): ProjectedExplanationSection[] {
  return applyUnifiedProjection(core, seed, undefined);
}

export function projectTextFromSemanticCore(
  core: SemanticCore,
  seed: string,
  options?: ProjectionOptions
): ProjectedExplanationSection[] {
  return applyUnifiedProjection(core, seed, options);
}

export function projectFeedCardFromSemanticCore(
  core: SemanticCore,
  seed: string,
  extras?: Partial<ProjectionOptions>
): ProjectedExplanationSection[] {
  return applyUnifiedProjection(core, seed, {
    phaseD: true,
    surface: 'feed',
    tier: 'baseline',
    ...extras,
  });
}
