/**
 * Phase 5 — Phantom archetype profiles.
 * Config only. No DB users/charts. Phantoms are derived vectors, ephemeral.
 */

export interface PhantomProfile {
  id: string;
  slug: string;
  label: string;
  version: string;
  transform_type: string;
  transform_params: Record<string, unknown>;
  algorithm_version: string;
}

export const PHANTOM_PROFILES: PhantomProfile[] = [
  {
    id: 'phantom_ideal_complement_v1',
    slug: 'ideal_complement',
    label: 'Ideal Complement',
    version: '1.0.0',
    transform_type: 'ideal_complement',
    transform_params: {},
    algorithm_version: 'phantom_v1',
  },
  {
    id: 'phantom_shadow_mirror_v1',
    slug: 'shadow_mirror',
    label: 'Shadow Mirror',
    version: '1.0.0',
    transform_type: 'shadow_mirror',
    transform_params: {},
    algorithm_version: 'phantom_v1',
  },
  {
    id: 'phantom_elemental_amplifier_v1',
    slug: 'elemental_amplifier',
    label: 'Elemental Amplifier',
    version: '1.0.0',
    transform_type: 'elemental_amplifier',
    transform_params: { boost_factor: 1.25 },
    algorithm_version: 'phantom_v1',
  },
  {
    id: 'phantom_stabilizer_v1',
    slug: 'stabilizer',
    label: 'Stabilizer',
    version: '1.0.0',
    transform_type: 'stabilizer',
    transform_params: { tension_factor: 0.7, element_mix_alpha: 0.35 },
    algorithm_version: 'phantom_v1',
  },
  {
    id: 'phantom_creative_catalyst_v1',
    slug: 'creative_catalyst',
    label: 'Creative Catalyst',
    version: '1.0.0',
    transform_type: 'creative_catalyst',
    transform_params: { tension_delta: 0.15 },
    algorithm_version: 'phantom_v1',
  },
];

const TRANSFORM_VERSION = '1.0.0';

export function getPhantomProfileBySlug(slug: string): PhantomProfile {
  const p = PHANTOM_PROFILES.find((x) => x.slug === slug);
  if (!p) throw new Error(`Phantom profile not found: slug=${slug}`);
  return p;
}

export function getPhantomProfileById(id: string): PhantomProfile {
  const p = PHANTOM_PROFILES.find((x) => x.id === id);
  if (!p) throw new Error(`Phantom profile not found: id=${id}`);
  return p;
}

export function getTransformVersion(): string {
  return TRANSFORM_VERSION;
}
