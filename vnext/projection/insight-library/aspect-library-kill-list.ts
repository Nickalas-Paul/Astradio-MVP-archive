/**
 * Aspect insight library kill-list — keys with authored entries that must not surface
 * until copy passes Tier audit (see docs/SYNASTRY-S5-STAGE-A-SPECIFICATION.md).
 *
 * Stage B Tier 1 audit: docs/audit-logs/synastry-tier1-audit-v1.csv
 * Stage C Tier 2 sample audit: docs/audit-logs/synastry-tier2-sample-audit-v1.csv
 * Phase 2A v2 re-audit: docs/audit-logs/synastry-v2-revaudit-v1.csv (15 Sun-pair
 *   entries from insight-library-aspects-personal.ts cleared after
 *   `phase2a-full-reaudit` returned accept on all 30 renders).
 * Phase 2B v2 audit: docs/audit-logs/synastry-v2-revaudit-v1.csv
 *   (MOON_VENUS_OPPOSITION and MOON_MARS_SQUARE cleared after
 *   `phase2b-full-audit` returned accept on all 30 renders).
 * Phase 2C v2 audit: docs/audit-logs/synastry-v2-revaudit-v1.csv
 *   (SATURN_SUN_CONJUNCTION and SATURN_SUN_SQUARE cleared after
 *   `phase2c-full-audit` returned accept on all 40 renders).
 * Phase 2D v2 audit: docs/audit-logs/synastry-v2-revaudit-v1.csv (6 Jupiter-pair
 *   entries cleared after `phase2d-full-audit` returned accept on all 40 renders).
 * Phase 2E v2 audit: docs/audit-logs/synastry-v2-revaudit-v1.csv
 *   (URANUS_SUN_SEXTILE and URANUS_SUN_TRINE cleared after
 *   `phase2e-full-audit` returned accept on all 40 renders).
 * Phase 2F v2 audit: docs/audit-logs/synastry-v2-revaudit-v1.csv
 *   (NEPTUNE_SUN_SEXTILE and NEPTUNE_SUN_TRINE cleared after
 *   `phase2f-full-audit` returned accept on all 40 renders).
 * Phase 2G v2 audit: docs/audit-logs/synastry-v2-revaudit-v1.csv
 *   (PLUTO_SUN_CONJUNCTION and PLUTO_SUN_OPPOSITION cleared after
 *   `phase2g-full-audit` returned accept on all 40 renders covering the 20
 *   Pluto-pair entries). With this clearance, the v2 Phase 2 retrofit is
 *   complete: 130 entries authored across 6 files, 220 audit renders all
 *   accept, and the kill-list reaches 0.
 *
 * The kill-list is currently empty. New entries should be added here only if
 * future audit passes identify keys whose authored content fails P1/P4 in
 * ways that cannot be fixed in the same commit.
 */

export type KillListReasonCode = 'P1_PAIR_CLARITY' | 'P4_SAFETY' | 'P1_P4' | 'OTHER';

export type AspectLibraryKillListEntry = {
  readonly aspectKey: string;
  readonly reasonCode: KillListReasonCode;
  readonly addedAt: string;
  readonly reviewer: string;
  readonly auditArtifactRef: string;
};

export const ASPECT_LIBRARY_KILL_LIST: readonly AspectLibraryKillListEntry[] = [] as const;

const KILL_SET = new Set<string>(ASPECT_LIBRARY_KILL_LIST.map((e) => e.aspectKey));

export function isAspectLibraryKillListed(aspectKey: string): boolean {
  return KILL_SET.has(aspectKey);
}
