/**
 * Astradio Insight Library — Chiron Aspects to Personal Planets (Phase 4 scope)
 *
 * Phase 1 scaffold: empty export so insight-library-index.ts compiles.
 * Phase 4 will populate this file with 20 entries:
 *   CHIRON × SUN, MOON, VENUS, MARS × 5 aspects each.
 *
 * Asteroid library content lives ahead of synastry compute wiring. Until the
 * CORE_BODIES filter in vnext/synastry/synastry-compute.ts is expanded to include
 * Chiron, these entries will not be reached by getAspectInsight at runtime.
 * That wiring expansion is a separate stream from v2 content authoring.
 *
 * Place at: vnext/projection/insight-library/insight-library-aspects-chiron.ts
 */

import type { AspectInsight } from './insight-library-types';

export const CHIRON_ASPECT_INSIGHTS: Readonly<Record<string, AspectInsight>> = {
  // Phase 4 content lands here.
} as const;
