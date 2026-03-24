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
    baselineMinSections: 4,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['temporal_integration', 'synthesis_a'],
      extended: ['temporal_integration', 'synthesis_a', 'synthesis_b', 'audio_thread'],
    },
  },
  profile: {
    surface: 'profile',
    baselineDensityDefault: 'medium',
    baselineMinSections: 6,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['trait_bridge', 'synthesis_a'],
      extended: ['trait_bridge', 'synthesis_a', 'synthesis_b', 'contradiction', 'audio_thread'],
    },
  },
  sandbox: {
    surface: 'sandbox',
    baselineDensityDefault: 'short',
    baselineMinSections: 3,
    sections: [
      { sectionKey: 'lab_readout', density: 'short', minClaimsReferenced: 1 },
      { sectionKey: 'configuration', density: 'medium', minClaimsReferenced: 2 },
    ],
    expansionSectionKeys: {
      expanded: ['delta_emphasis'],
      extended: ['delta_emphasis', 'synthesis_a'],
    },
  },
  overlay_pair: {
    surface: 'overlay_pair',
    baselineDensityDefault: 'medium',
    baselineMinSections: 3,
    sections: [
      { sectionKey: 'natal_transit', density: 'medium', minClaimsReferenced: 2 },
      { sectionKey: 'bridge', density: 'medium', minClaimsReferenced: 2 },
    ],
    expansionSectionKeys: {
      expanded: ['layering', 'synthesis_a'],
      extended: ['layering', 'synthesis_a', 'audio_thread'],
    },
  },
  compat_pair: {
    surface: 'compat_pair',
    baselineDensityDefault: 'medium',
    baselineMinSections: 6,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['interaction_map', 'synthesis_a'],
      extended: ['interaction_map', 'synthesis_a', 'synthesis_b', 'contradiction', 'audio_thread'],
    },
  },
  group: {
    surface: 'group',
    baselineDensityDefault: 'medium',
    baselineMinSections: 6,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['field_distribution', 'synthesis_a'],
      extended: ['field_distribution', 'synthesis_a', 'synthesis_b', 'subcluster', 'audio_thread'],
    },
  },
  campaign: {
    surface: 'campaign',
    baselineDensityDefault: 'medium',
    baselineMinSections: 4,
    sections: medium,
    expansionSectionKeys: {
      expanded: ['pressure_response', 'synthesis_a'],
      extended: ['pressure_response', 'synthesis_a', 'synthesis_b'],
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
