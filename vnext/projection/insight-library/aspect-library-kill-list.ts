/**
 * Aspect insight library kill-list — keys with authored entries that must not surface
 * until copy passes Tier audit (see docs/SYNASTRY-S5-STAGE-A-SPECIFICATION.md).
 *
 * Stage B Tier 1 audit: docs/audit-logs/synastry-tier1-audit-v1.csv
 * Stage C Tier 2 sample audit: docs/audit-logs/synastry-tier2-sample-audit-v1.csv
 * Phase 2A v2 re-audit: docs/audit-logs/synastry-v2-revaudit-v1.csv (15 Sun-pair
 *   entries from insight-library-aspects-personal.ts cleared after
 *   `phase2a-full-reaudit` returned accept on all 30 renders. Specifically:
 *   SUN_MOON, SUN_VENUS, SUN_MARS × 5 aspects each. The 4 JUPITER_SUN_*
 *   entries below remain kill-listed because they live in
 *   insight-library-aspects-jupiter.ts and their content has not yet been
 *   revised under v2 (Phase 2D scope).
 */

export type KillListReasonCode = 'P1_PAIR_CLARITY' | 'P4_SAFETY' | 'P1_P4' | 'OTHER';

export type AspectLibraryKillListEntry = {
  readonly aspectKey: string;
  readonly reasonCode: KillListReasonCode;
  readonly addedAt: string;
  readonly reviewer: string;
  readonly auditArtifactRef: string;
};

export const ASPECT_LIBRARY_KILL_LIST: readonly AspectLibraryKillListEntry[] = [
  {
    aspectKey: 'JUPITER_SUN_CONJUNCTION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 32',
  },
  {
    aspectKey: 'JUPITER_SUN_SEXTILE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 34',
  },
  {
    aspectKey: 'JUPITER_SUN_SQUARE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 36',
  },
  {
    aspectKey: 'JUPITER_SUN_TRINE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 38',
  },
  {
    aspectKey: 'JUPITER_SUN_OPPOSITION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 2',
  },
  {
    aspectKey: 'SATURN_SUN_CONJUNCTION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 4',
  },
  {
    aspectKey: 'SATURN_SUN_SQUARE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 6',
  },
  {
    aspectKey: 'URANUS_SUN_SEXTILE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 8',
  },
  {
    aspectKey: 'URANUS_SUN_TRINE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 10',
  },
  {
    aspectKey: 'NEPTUNE_SUN_SEXTILE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 12',
  },
  {
    aspectKey: 'NEPTUNE_SUN_TRINE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 14',
  },
  {
    aspectKey: 'PLUTO_SUN_CONJUNCTION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 16',
  },
  {
    aspectKey: 'PLUTO_SUN_OPPOSITION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 18',
  },
  {
    aspectKey: 'MOON_VENUS_OPPOSITION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 20',
  },
  {
    aspectKey: 'MOON_MARS_SQUARE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 22',
  },
  {
    aspectKey: 'JUPITER_MOON_CONJUNCTION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-04',
    reviewer: 's5-tier2-sampler',
    auditArtifactRef: 'docs/audit-logs/synastry-tier2-sample-audit-v1.csv:row 24',
  },
] as const;

const KILL_SET = new Set<string>(ASPECT_LIBRARY_KILL_LIST.map((e) => e.aspectKey));

export function isAspectLibraryKillListed(aspectKey: string): boolean {
  return KILL_SET.has(aspectKey);
}
