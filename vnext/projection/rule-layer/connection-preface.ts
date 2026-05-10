/**
 * Connection / ensemble preface — private to rule layer; only called from assemble-sections.
 * **Proj:** sentence-bundle step (legacy “Phase 2” wording in older notes) — fixed bundles only (deterministic); not Product:Phase-2.
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import type { ConnectionMode, ExpansionTier, ProjectedExplanationSection, ProjectionSurface } from '../projection-types';

export function applyConnectionPreface(
  sections: ProjectedExplanationSection[],
  opts: {
    surface: ProjectionSurface;
    connectionMode?: ConnectionMode;
    participantCount?: number;
    tier: ExpansionTier;
    seed: string;
    suppressEnsembleFraming?: boolean;
  }
): ProjectedExplanationSection[] {
  void opts;
  return [...sections];
}
