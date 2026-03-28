/**
 * Phase 1 synthetic eligibility traits ONLY.
 *
 * REMOVE when: (1) real trait engine populates activated_trait_ids from placements
 * for all supported body/house cases in solo and group, AND (2) PressureEvent
 * no longer needs synthetic tokens for eligibility.
 *
 * Do not infer gameplay semantics from these strings — count/existence only.
 */

import type { EphemerisSnapshot } from '../../contracts';
import { lonToSign } from '../../astro/profile-from-snapshot';

const SIGN_TO_MODALITY: Record<string, 'cardinal' | 'fixed' | 'mutable'> = {
  Aries: 'cardinal',
  Taurus: 'fixed',
  Gemini: 'mutable',
  Cancer: 'cardinal',
  Leo: 'fixed',
  Virgo: 'mutable',
  Libra: 'cardinal',
  Scorpio: 'fixed',
  Sagittarius: 'mutable',
  Capricorn: 'cardinal',
  Aquarius: 'fixed',
  Pisces: 'mutable',
};

export const TRAIT_DERIVATION_MODE_PHASE1 = 'phase1_synthetic_v1' as const;

export function sunModalityTokenFromNatal(natal: EphemerisSnapshot): 'cardinal' | 'fixed' | 'mutable' {
  const sun = natal.planets.find((p) => String(p.name).toLowerCase() === 'sun');
  if (!sun || !Number.isFinite(sun.lon)) return 'cardinal';
  const { sign } = lonToSign(sun.lon);
  return SIGN_TO_MODALITY[sign] ?? 'cardinal';
}

/**
 * Command-Center naming: eligibility_trait_phase1_v1:{natal_body}:{natal_house}:{modality_token}
 */
export function buildPhase1SyntheticTraitId(
  natalBody: string,
  natalHouse: number,
  natal: EphemerisSnapshot
): string {
  const mod = sunModalityTokenFromNatal(natal);
  return `eligibility_trait_phase1_v1:${natalBody}:${natalHouse}:${mod}`;
}
