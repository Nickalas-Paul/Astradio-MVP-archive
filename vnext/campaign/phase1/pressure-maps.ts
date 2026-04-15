// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

import type { CampaignBodyId, DomainId, PressureFamily, Phase1AspectType } from './contracts';
import type { AspectTypeKey } from '../../aspect-engine';
import { ASPECT_CONFIG } from '../../aspect-engine';
import { CORE_BODIES } from '../../canonical-bodies';

export const PRESSURE_FAMILY_BY_TRANSIT_BODY: Record<CampaignBodyId, PressureFamily> = {
  sun: 'identity',
  moon: 'emotional',
  mercury: 'cognitive',
  venus: 'value',
  mars: 'conflict',
  jupiter: 'expansion',
  saturn: 'constraint',
  uranus: 'disruption',
  neptune: 'dissolution',
  pluto: 'transformation',
};

export const DOMAIN_ID_BY_HOUSE: Record<number, DomainId> = {
  1: 'self',
  2: 'assets',
  3: 'communication',
  4: 'home',
  5: 'creativity',
  6: 'work',
  7: 'partnership',
  8: 'transformation',
  9: 'belief',
  10: 'career',
  11: 'community',
  12: 'subconscious',
};

/** Same membership as `CORE_BODIES` / `computeCrossAspectsForMember` (single source). */
const PHASE1_GEOMETRY_BODY_SET = new Set<string>(CORE_BODIES.map((b) => b));

export function isPhase1SupportedCrossAspectBody(name: string): name is CampaignBodyId {
  return PHASE1_GEOMETRY_BODY_SET.has(name.toLowerCase());
}

export function toCampaignBodyId(name: string): CampaignBodyId | null {
  const k = name.toLowerCase();
  if (!isPhase1SupportedCrossAspectBody(k)) return null;
  return k as CampaignBodyId;
}

export function allowedOrbForAspect(type: Phase1AspectType): number {
  return ASPECT_CONFIG[type as AspectTypeKey].orb;
}

export function aspectBaseWeight(type: Phase1AspectType): number {
  switch (type) {
    case 'conjunction':
      return 1.4;
    case 'opposition':
      return 1.35;
    case 'square':
      return 1.3;
    case 'trine':
      return 1.1;
    case 'sextile':
      return 1.05;
    default:
      return 1;
  }
}

export function bodyPairSourceWeight(transitBody: string, natalBody: string): number {
  const w = (n: string) => {
    const x = n.toLowerCase();
    if (x === 'sun' || x === 'moon') return 1.15;
    if (x === 'mercury') return 1.08;
    if (x === 'venus' || x === 'mars') return 1.06;
    if (x === 'jupiter' || x === 'saturn') return 1.0;
    if (x === 'uranus' || x === 'neptune' || x === 'pluto') return 1.12;
    return 1.0;
  };
  const raw = w(transitBody) * w(natalBody);
  return Math.min(1, raw / (1.15 * 1.15));
}
