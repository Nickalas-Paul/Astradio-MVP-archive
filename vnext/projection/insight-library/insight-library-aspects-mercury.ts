/**
 * Astradio Insight Library — Mercury Aspects (Phase 3 scope)
 *
 * Phase 1 scaffold: empty export so insight-library-index.ts compiles.
 * Phase 3 will populate this file with Mercury aspect entries:
 *   - SUN_MERCURY × 5 aspects (Tier 1 priority per inventory)
 *   - MOON_MERCURY × 5 aspects
 *   - MERCURY_VENUS × 5 aspects
 *   - MERCURY_MARS × 5 aspects
 *   - MERCURY_MERCURY × 5 aspects (synastry-only, no natal occurrence)
 *   - All outer-MERCURY pairs × 5 aspects (Saturn, Jupiter, Uranus, Neptune, Pluto)
 *
 * Place at: vnext/projection/insight-library/insight-library-aspects-mercury.ts
 */

import type { AspectInsight } from './insight-library-types';

export const MERCURY_ASPECT_INSIGHTS: Readonly<Record<string, AspectInsight>> = {
  // Phase 3 content lands here.
} as const;
