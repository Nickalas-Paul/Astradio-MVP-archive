/**
 * TEMPORARY Phase 1 bridge: DailyPressureState + PressureEvent[] -> TransitPressure[]
 * so buildChallengeScene keeps working until ChallengeArchetype consumes DailyPressureState directly.
 *
 * Does NOT read synthetic trait strings — only PressureEvent scalar fields.
 * DELETE when challenge layer is wired to DailyPressureState.
 */

import type { TransitPressure, TransitPressureType } from '../../rpg/types';
import type { PressureEvent, DailyPressureState, PressureFamily } from './contracts';
import type { RPGDomainScore } from '../../rpg/contracts';

function familyToTransitType(f: PressureFamily): TransitPressureType {
  switch (f) {
    case 'conflict':
    case 'disruption':
      return 'conflict';
    case 'constraint':
    case 'recurrence':
      return 'constraint';
    case 'dissolution':
    case 'cognitive':
      return 'confusion';
    case 'transformation':
    case 'wound':
      return 'restructuring';
    case 'expansion':
    case 'value':
    case 'identity':
    case 'emotional':
    case 'directional':
    default:
      return 'invitation';
  }
}

function domainToLifeArea(domain: string): string {
  if (domain === 'self' || domain === 'belief') return 'identity';
  if (domain === 'partnership' || domain === 'community') return 'relationships';
  if (domain === 'career' || domain === 'work') return 'work_public';
  if (domain === 'home' || domain === 'assets') return 'home_foundations';
  if (domain === 'creativity' || domain === 'subconscious') return 'inner_world';
  return 'inner_world';
}

function emptyContributing(domain: string): RPGDomainScore[] {
  return [
    {
      domain: `phase1_${domain}`,
      score: 1,
      normalizedScore: 1,
      contributingSignals: [],
    },
  ];
}

function eventToTransit(p: PressureEvent): TransitPressure {
  const type = familyToTransitType(p.pressure_family);
  return {
    id: p.pressure_event_id,
    domain: p.domain_id,
    type,
    intensity: p.intensity_score,
    lifeArea: domainToLifeArea(p.domain_id),
    likelyShadowPattern: `phase1_shadow:${p.pressure_polarity}`,
    growthPath: `phase1_growth:${p.interaction_hint}`,
    contributingDomains: emptyContributing(p.domain_id),
  };
}

/** Map resolution seed to legacy pressures for buildChallengeScene. */
export function campaignSeedToLegacyTransitPressures(
  events: PressureEvent[],
  daily: DailyPressureState | null
): TransitPressure[] {
  if (!daily) return [];
  const byId = new Map(events.map((e) => [e.pressure_event_id, e]));
  const primary = byId.get(daily.primary_pressure_event_id);
  if (!primary) return [];
  const out: TransitPressure[] = [eventToTransit(primary)];
  for (const s of daily.supporting_pressures) {
    const e = byId.get(s.pressure_event_id);
    if (e) out.push(eventToTransit(e));
  }
  return out;
}
