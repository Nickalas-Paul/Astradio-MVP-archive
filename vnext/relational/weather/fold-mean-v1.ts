/**
 * Stage 7 v1 — Arithmetic mean across members (connection-level fold).
 */

import type { MemberBucketTotalsV1 } from './bucket-mapping-v1';

export type ConnectionActivationV1 = {
  harmony: number;
  friction: number;
  intensity: number;
  emotional_activation: number;
  communication_emphasis: number;
  volatility: number;
  growth_pressure: number;
};

export function foldMeanMemberBuckets(normalizedPerMember: MemberBucketTotalsV1[]): ConnectionActivationV1 {
  const k = normalizedPerMember.length;
  if (k === 0) {
    return {
      harmony: 0,
      friction: 0,
      intensity: 0,
      emotional_activation: 0,
      communication_emphasis: 0,
      volatility: 0,
      growth_pressure: 0,
    };
  }
  const sum = normalizedPerMember.reduce(
    (acc, m) => ({
      harmony: acc.harmony + m.harmony,
      friction: acc.friction + m.friction,
      intensity: acc.intensity + m.intensity,
      emotional_activation: acc.emotional_activation + m.emotional_activation,
      communication_emphasis: acc.communication_emphasis + m.communication_emphasis,
      volatility: acc.volatility + m.volatility,
      growth_pressure: acc.growth_pressure + m.growth_pressure,
    }),
    {
      harmony: 0,
      friction: 0,
      intensity: 0,
      emotional_activation: 0,
      communication_emphasis: 0,
      volatility: 0,
      growth_pressure: 0,
    }
  );
  return {
    harmony: sum.harmony / k,
    friction: sum.friction / k,
    intensity: sum.intensity / k,
    emotional_activation: sum.emotional_activation / k,
    communication_emphasis: sum.communication_emphasis / k,
    volatility: sum.volatility / k,
    growth_pressure: sum.growth_pressure / k,
  };
}
