/**
 * Astradio Insight Library — Juno Aspects to Personal Planets (Phase 4 scope)
 *
 * Phase 1 scaffold: empty export so insight-library-index.ts compiles.
 * Phase 4 will populate this file with 20 entries:
 *   JUNO × SUN, MOON, VENUS, MARS × 5 aspects each.
 *
 * See insight-library-aspects-chiron.ts for the wiring-vs-content separation note.
 *
 * Place at: vnext/projection/insight-library/insight-library-aspects-juno.ts
 */

import type { AspectInsight } from './insight-library-types';

export const JUNO_ASPECT_INSIGHTS: Readonly<Record<string, AspectInsight>> = {
  // Phase 4 content lands here.
} as const;
