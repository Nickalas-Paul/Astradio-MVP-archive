import type { ArchitectureOutput } from '../core/architecture-engine';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import type { SemanticCore } from '../semantic/semantic-core';

export function semanticCoreAndPlanetsFromArchitecture(
  arch: ArchitectureOutput,
  surface: 'profile_natal' | 'home_daily' = 'profile_natal'
): { core: SemanticCore; dominantPlanetNames: readonly string[] } {
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: surface,
    subject_ids: [arch.seed],
    snapshot: arch.snapshot,
    featureVec: arch.features,
    control_surface_hash: arch.seed,
    compose_seed: arch.seed,
    guidance: arch.guidance,
  });
  return {
    core: interpretCanonicalReportObject(canonical),
    dominantPlanetNames: canonical.participants[0].dominant_planet_names,
  };
}
