// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import type { CampaignBodyId, PressurePolarity, Phase1AspectType } from './contracts';

const VOLATILE_CONJ = new Set<CampaignBodyId>(['mars', 'uranus', 'pluto', 'neptune']);

/**
 * Locked polarity: aspect base + conjunction overrides.
 */
export function derivePressurePolarity(
  aspectType: Phase1AspectType,
  transitBody: CampaignBodyId,
  natalBody: CampaignBodyId
): PressurePolarity {
  if (aspectType === 'trine' || aspectType === 'sextile') return 'constructive';
  if (aspectType === 'square' || aspectType === 'opposition') {
    if (transitBody === 'saturn' || natalBody === 'saturn') return 'binding';
    return 'frictional';
  }
  if (aspectType === 'conjunction') {
    if (VOLATILE_CONJ.has(transitBody) || VOLATILE_CONJ.has(natalBody)) return 'volatile';
    if (transitBody === 'saturn' || natalBody === 'saturn') return 'binding';
    return 'constructive';
  }
  return 'constructive';
}
