/**
 * Aspect insight library kill-list — keys with authored entries that must not surface
 * until copy passes Tier audit (see docs/SYNASTRY-S5-STAGE-A-SPECIFICATION.md).
 *
 * Stage B Tier 1 audit: docs/audit-logs/synastry-tier1-audit-v1.csv
 * Stage C Tier 2 sample audit: docs/audit-logs/synastry-tier2-sample-audit-v1.csv
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
    aspectKey: 'SUN_MOON_CONJUNCTION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 2',
  },
  {
    aspectKey: 'SUN_MOON_SEXTILE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 4',
  },
  {
    aspectKey: 'SUN_MOON_SQUARE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 6',
  },
  {
    aspectKey: 'SUN_MOON_TRINE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 8',
  },
  {
    aspectKey: 'SUN_MOON_OPPOSITION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 10',
  },
  {
    aspectKey: 'SUN_VENUS_CONJUNCTION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 12',
  },
  {
    aspectKey: 'SUN_VENUS_SEXTILE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 14',
  },
  {
    aspectKey: 'SUN_VENUS_SQUARE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 16',
  },
  {
    aspectKey: 'SUN_VENUS_TRINE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 18',
  },
  {
    aspectKey: 'SUN_VENUS_OPPOSITION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 20',
  },
  {
    aspectKey: 'SUN_MARS_CONJUNCTION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 22',
  },
  {
    aspectKey: 'SUN_MARS_SEXTILE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 24',
  },
  {
    aspectKey: 'SUN_MARS_SQUARE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 26',
  },
  {
    aspectKey: 'SUN_MARS_TRINE',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 28',
  },
  {
    aspectKey: 'SUN_MARS_OPPOSITION',
    reasonCode: 'P1_PAIR_CLARITY',
    addedAt: '2026-05-03',
    reviewer: 'tier1-single-reviewer',
    auditArtifactRef: 'docs/audit-logs/synastry-tier1-audit-v1.csv:row 30',
  },
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
