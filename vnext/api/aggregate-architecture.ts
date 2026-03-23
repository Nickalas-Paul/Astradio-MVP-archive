/**
 * Phase B — architecture package for aggregate composition: real anchor snapshot + composite feature vector.
 */

import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ArchitectureOutput } from '../core/architecture-engine';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildAstroProfile } from '../astro/profile-from-snapshot';
import { buildRelationalChartContext } from '../report-context';

/**
 * Anchor snapshot is the first chart in deterministic order (snapLow / snapshotsOrdered[0]).
 * Guidance uses compositeFeatureVec with that real sky context.
 */
export function buildArchitectureForAggregate(
  anchorSnapshot: EphemerisSnapshot,
  compositeFeatureVec: FeatureVec,
  seed: string
): ArchitectureOutput {
  const guidance = guidanceFromFeatures(compositeFeatureVec, anchorSnapshot, seed);
  const personality = guidance.personality;
  const astroProfile = buildAstroProfile(anchorSnapshot);
  const relationalContext = buildRelationalChartContext(anchorSnapshot);
  return {
    snapshot: anchorSnapshot,
    features: compositeFeatureVec,
    personality,
    astroProfile,
    guidance,
    relationalContext,
    seed,
  };
}
