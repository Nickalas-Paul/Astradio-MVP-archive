import type { EphemerisSnapshot } from '../contracts';
import type { RPGDomainScore } from './contracts';
import { detectTransitSignals } from './transit/signal-detection';
import { translateSignalsToDomains } from './transit/domain-translation';
import type { TransitPressure, TransitPressureType } from './types';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function classifyPressureType(domain: string, tensionRatio: number): TransitPressureType {
  if (domain.includes('crisis') || domain.includes('conflict')) return 'conflict';
  if (domain.includes('constraint') || domain.includes('duty') || domain.includes('limits')) {
    return 'constraint';
  }
  if (domain.includes('release') || domain.includes('catharsis')) return 'release';
  if (domain.includes('renewal') || domain.includes('restructuring')) return 'restructuring';
  if (domain.includes('endurance') || domain.includes('trial')) return 'endurance';
  if (domain.includes('fog') || domain.includes('ambiguity') || domain.includes('uncertainty')) {
    return 'confusion';
  }
  if (domain.includes('insight') || domain.includes('revelation')) return 'revelation';
  return tensionRatio >= 0.6 ? 'constraint' : 'invitation';
}

function lifeAreaFromDomain(domain: string): string {
  if (domain.includes('identity') || domain.includes('self')) return 'identity';
  if (domain.includes('bond') || domain.includes('relationship') || domain.includes('community')) {
    return 'relationships';
  }
  if (domain.includes('career') || domain.includes('reputation') || domain.includes('public')) {
    return 'work_public';
  }
  if (domain.includes('home') || domain.includes('roots') || domain.includes('family')) {
    return 'home_foundations';
  }
  if (domain.includes('health') || domain.includes('body')) return 'health_body';
  return 'inner_world';
}

function shadowPatternForType(type: TransitPressureType): string {
  switch (type) {
    case 'constraint':
      return 'pushing harder against a closed door instead of adjusting the plan';
    case 'invitation':
      return 'saying yes automatically without checking capacity or desire';
    case 'conflict':
      return 'turning disagreement into identity threat or withdrawal';
    case 'confusion':
      return 'freezing until the moment passes instead of tolerating ambiguity';
    case 'revelation':
      return 'ignoring clear insight because it would require change';
    case 'endurance':
      return 'white-knuckling through strain without pacing or support';
    case 'restructuring':
      return 'clinging to old structures even when they clearly no longer fit';
    case 'release':
      return 'dumping everything at once instead of choosing what to lay down';
  }
}

function growthPathForType(type: TransitPressureType): string {
  switch (type) {
    case 'constraint':
      return 'name the actual limit, then choose one courageous step that fits inside it';
    case 'invitation':
      return 'discern one specific invitation and respond with a clear, bounded yes';
    case 'conflict':
      return 'separate disagreement from worth and name the shared aim out loud';
    case 'confusion':
      return 'stay with the question long enough to find one next honest experiment';
    case 'revelation':
      return 'acknowledge the new understanding and choose one behavior that reflects it';
    case 'endurance':
      return 'pace your energy, honor your effort, and ask explicitly for one form of support';
    case 'restructuring':
      return 'decide one structure to retire and one small replacement to test';
    case 'release':
      return 'consciously choose what to lay down and what you are making room for';
  }
}

export interface BuildTransitPressureMapParams {
  natalSnapshot: EphemerisSnapshot;
  transitSnapshot: EphemerisSnapshot;
}

export function buildTransitPressureMap(
  params: BuildTransitPressureMapParams
): TransitPressure[] {
  const { transitSnapshot } = params;

  const signals = detectTransitSignals(transitSnapshot);
  const domains = translateSignalsToDomains(signals);

  if (!domains.length) {
    return [];
  }

  const maxScore = domains[0].score || 1;

  // Deterministic order: domains from translateSignalsToDomains are sorted (score DESC, domain ASC).
  const pressures: TransitPressure[] = domains.slice(0, 8).map((d, idx) => {
    const intensity = clamp01(d.score / maxScore);
    const tensionRatio = clamp01(d.normalizedScore);
    const type = classifyPressureType(d.domain, tensionRatio);
    const lifeArea = lifeAreaFromDomain(d.domain);
    const likelyShadowPattern = shadowPatternForType(type);
    const growthPath = growthPathForType(type);

    return {
      id: `tp_${idx}_${d.domain}`,
      domain: d.domain,
      type,
      intensity,
      lifeArea,
      likelyShadowPattern,
      growthPath,
      contributingDomains: [d as RPGDomainScore],
    };
  });

  return pressures;
}

