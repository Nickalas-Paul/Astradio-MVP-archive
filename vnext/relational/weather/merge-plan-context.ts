/**
 * Stage 7 — Merge relational weather scalars into plan chart context (narrow allowlist).
 */

import type { RelationalWeatherStateV1 } from './types';

const RW_KEYS = [
  'rw_harmony',
  'rw_friction',
  'rw_intensity',
  'rw_emotional_activation',
  'rw_communication_emphasis',
  'rw_volatility',
  'rw_growth_pressure',
  'rw_score_raw',
  'rw_score_significance',
  'relational_weather_state_hash',
  'relational_weather_version',
] as const;

export function mergeRelationalWeatherIntoPlanChartContext(
  planChartContext: Record<string, unknown>,
  weather: RelationalWeatherStateV1
): Record<string, unknown> {
  const w = weather;
  const extra: Record<string, unknown> = {
    rw_harmony: w.activation.harmony,
    rw_friction: w.activation.friction,
    rw_intensity: w.activation.intensity,
    rw_emotional_activation: w.activation.emotional_activation,
    rw_communication_emphasis: w.activation.communication_emphasis,
    rw_volatility: w.activation.volatility,
    rw_growth_pressure: w.activation.growth_pressure,
    rw_score_raw: w.score.raw,
    rw_score_significance: w.score.significance,
    relational_weather_state_hash: w.stateHash,
    relational_weather_version: w.version,
  };
  return { ...planChartContext, ...extra };
}

export function relationalWeatherContextKeys(): readonly string[] {
  return RW_KEYS;
}
