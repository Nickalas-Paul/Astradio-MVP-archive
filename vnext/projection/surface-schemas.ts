/**
 * Phase D — machine-readable surface schemas (baseline + expansion keys).
 */
import type { ExpansionTier, ProjectionSurface, SurfaceSchemaDefinition } from './projection-types';

const medium: SurfaceSchemaDefinition['sections'] = [
  { sectionKey: 'core_pattern', density: 'medium', minClaimsReferenced: 2 },
  { sectionKey: 'expression', density: 'medium', minClaimsReferenced: 2 },
];

export const SURFACE_SCHEMAS: Record<ProjectionSurface, SurfaceSchemaDefinition> = {
  feed: {
    surface: 'feed',
    baselineDensityDefault: 'short',
    baselineMinSections: 1,
    maxSectionsFeed: 2,
    sections: [
      { sectionKey: 'signal', density: 'short', minClaimsReferenced: 1 },
      { sectionKey: 'context', density: 'short', minClaimsReferenced: 1 },
    ],
    expansionSectionKeys: { expanded: [], extended: [] },
  },
  daily: {
    surface: 'daily',
    baselineDensityDefault: 'medium',
    baselineMinSections: 2,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['synthesis_a'],
      extended: ['synthesis_a', 'synthesis_b'],
    },
  },
  profile: {
    surface: 'profile',
    baselineDensityDefault: 'medium',
    baselineMinSections: 2,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['synthesis_a'],
      extended: ['synthesis_a', 'synthesis_b'],
    },
  },
  sandbox: {
    surface: 'sandbox',
    baselineDensityDefault: 'short',
    /** Phase 3: minimal depth filler; structural count comes from template spine + expansions. */
    baselineMinSections: 1,
    sections: [
      { sectionKey: 'lab_readout', density: 'short', minClaimsReferenced: 1 },
      { sectionKey: 'configuration', density: 'medium', minClaimsReferenced: 2 },
    ],
    expansionSectionKeys: {
      expanded: [],
      extended: ['synthesis_a'],
    },
  },
  overlay_pair: {
    surface: 'overlay_pair',
    baselineDensityDefault: 'medium',
    baselineMinSections: 1,
    sections: [
      { sectionKey: 'natal_transit', density: 'medium', minClaimsReferenced: 2 },
      { sectionKey: 'bridge', density: 'medium', minClaimsReferenced: 2 },
    ],
    expansionSectionKeys: {
      expanded: ['synthesis_a'],
      extended: ['synthesis_a'],
    },
  },
  compat_pair: {
    surface: 'compat_pair',
    baselineDensityDefault: 'medium',
    baselineMinSections: 2,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['synthesis_a'],
      extended: ['synthesis_a', 'synthesis_b'],
    },
  },
  group: {
    surface: 'group',
    baselineDensityDefault: 'medium',
    baselineMinSections: 2,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['synthesis_a'],
      extended: ['synthesis_a', 'synthesis_b'],
    },
  },
  campaign: {
    surface: 'campaign',
    baselineDensityDefault: 'medium',
    baselineMinSections: 2,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['synthesis_a'],
      extended: ['synthesis_a', 'synthesis_b'],
    },
  },
};

export function expansionKeysFor(surface: ProjectionSurface, tier: ExpansionTier): string[] {
  const s = SURFACE_SCHEMAS[surface];
  if (surface === 'feed') return [];
  if (tier === 'baseline') return [];
  if (tier === 'expanded') return [...s.expansionSectionKeys.expanded];
  return Array.from(new Set([...s.expansionSectionKeys.expanded, ...s.expansionSectionKeys.extended]));
}
