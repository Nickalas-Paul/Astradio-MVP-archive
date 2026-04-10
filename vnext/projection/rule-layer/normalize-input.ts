/**
 * Step 1 — input normalization (read-only bundle for the projection pipeline).
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { ExpansionTier, ProjectionOptions } from '../projection-types';

export type NormalizedProjectionInput = {
  readonly core: SemanticCore;
  readonly seed: string;
  readonly options: ProjectionOptions;
  readonly tierMetaRequested: ExpansionTier;
  readonly tierEff: ExpansionTier;
};

export function normalizeProjectionInput(
  core: SemanticCore,
  seed: string,
  options: ProjectionOptions
): NormalizedProjectionInput {
  const tierMetaRequested: ExpansionTier = options.originalTierRequested ?? options.tier ?? 'baseline';
  const tierEff: ExpansionTier = options.tier ?? 'baseline';
  return { core, seed, options, tierMetaRequested, tierEff };
}
