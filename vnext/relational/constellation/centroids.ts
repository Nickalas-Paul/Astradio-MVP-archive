/**
 * Phase 5 — Constellation centroid definitions.
 * Fixed list, versioned in code. No DB writes. Deterministic.
 * Element dims 27–30 (fire, earth, air, water). See vnext/relational/constants.ts.
 */

import { FEATURE_ELEMENT_INDICES } from '../constants';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Build 64-D centroid vector: neutral 0.5 base, element dims 27–30 set explicitly. */
function buildCentroidVector(
  elements: [number, number, number, number] // fire, earth, air, water
): number[] {
  const vec = new Array<number>(64).fill(0.5);
  FEATURE_ELEMENT_INDICES.forEach((i, j) => {
    vec[i] = clamp01(elements[j]);
  });
  return vec.map(clamp01);
}

export interface ConstellationCentroid {
  id: string;
  slug: string;
  label: string;
  version: string;
  algorithm_version: string;
  eligibility_threshold: number;
  vector64: number[];
}

const ALGORITHM_VERSION = 'constellation_v1';

/** 7 constellation centroids. Element-centric ones sculpt 27–30; others use neutral [0.25,0.25,0.25,0.25]. */
export const CONSTELLATION_CENTROIDS: ConstellationCentroid[] = [
  {
    id: 'centroid_cardinal_builders_v1',
    slug: 'cardinal_builders',
    label: 'Cardinal Builders',
    version: '1.0.0',
    algorithm_version: ALGORITHM_VERSION,
    eligibility_threshold: 0.60,
    vector64: buildCentroidVector([0.25, 0.25, 0.25, 0.25]),
  },
  {
    id: 'centroid_fixed_anchors_v1',
    slug: 'fixed_anchors',
    label: 'Fixed Anchors',
    version: '1.0.0',
    algorithm_version: ALGORITHM_VERSION,
    eligibility_threshold: 0.60,
    vector64: buildCentroidVector([0.25, 0.25, 0.25, 0.25]),
  },
  {
    id: 'centroid_mutable_adapters_v1',
    slug: 'mutable_adapters',
    label: 'Mutable Adapters',
    version: '1.0.0',
    algorithm_version: ALGORITHM_VERSION,
    eligibility_threshold: 0.60,
    vector64: buildCentroidVector([0.25, 0.25, 0.25, 0.25]),
  },
  {
    id: 'centroid_depth_water_v1',
    slug: 'depth_water',
    label: 'Depth Water',
    version: '1.0.0',
    algorithm_version: ALGORITHM_VERSION,
    eligibility_threshold: 0.60,
    vector64: buildCentroidVector([0.1, 0.1, 0.1, 0.7]), // water dominant
  },
  {
    id: 'centroid_air_strategists_v1',
    slug: 'air_strategists',
    label: 'Air Strategists',
    version: '1.0.0',
    algorithm_version: ALGORITHM_VERSION,
    eligibility_threshold: 0.60,
    vector64: buildCentroidVector([0.1, 0.1, 0.7, 0.1]), // air dominant
  },
  {
    id: 'centroid_fire_output_v1',
    slug: 'fire_output',
    label: 'Fire Output',
    version: '1.0.0',
    algorithm_version: ALGORITHM_VERSION,
    eligibility_threshold: 0.60,
    vector64: buildCentroidVector([0.7, 0.1, 0.1, 0.1]), // fire dominant
  },
  {
    id: 'centroid_earth_stabilizers_v1',
    slug: 'earth_stabilizers',
    label: 'Earth Stabilizers',
    version: '1.0.0',
    algorithm_version: ALGORITHM_VERSION,
    eligibility_threshold: 0.60,
    vector64: buildCentroidVector([0.1, 0.7, 0.1, 0.1]), // earth dominant
  },
];
