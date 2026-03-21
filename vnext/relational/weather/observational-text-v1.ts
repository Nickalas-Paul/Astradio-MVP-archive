/**
 * Stage 7 v1 — Observational copy from precomputed weather only (formatter, not engine).
 */

import type { RelationalWeatherStateV1 } from './types';

/** ExplainSpec-style annex: consumes precomputed state only (no aspect recompute). */
export function buildRelationalWeatherExplainAnnex(state: RelationalWeatherStateV1): {
  sectionId: string;
  title: string;
  text: string;
} {
  return {
    sectionId: 'relational_weather_v1',
    title: 'Relational field (current transit)',
    text: formatRelationalWeatherObservationalV1(state),
  };
}

/**
 * Short structural summary for aggregate text layering. No advice or imperatives.
 */
export function formatRelationalWeatherObservationalV1(state: RelationalWeatherStateV1): string {
  const a = state.activation;
  const t = state.themes.dominantThemes;
  const lines = [
    'Relational field (transit to member charts): structural readout only.',
    `Harmony signal: ${a.harmony.toFixed(3)} · Friction signal: ${a.friction.toFixed(3)} · Intensity: ${a.intensity.toFixed(3)}.`,
    `Emotional activation: ${a.emotional_activation.toFixed(3)} · Communication emphasis: ${a.communication_emphasis.toFixed(3)}.`,
    `Volatility pressure: ${a.volatility.toFixed(3)} · Growth pressure: ${a.growth_pressure.toFixed(3)}.`,
    `Ranking score (raw): ${state.score.raw.toFixed(4)} · Significance: ${state.score.significance.toFixed(4)}.`,
  ];
  if (t.length > 0) {
    lines.push(`Structural themes: ${t.join(', ')}.`);
  }
  const top = state.aspects.topCrossAspects.slice(0, 4);
  if (top.length > 0) {
    lines.push(
      'Strongest geometric contacts (transit body to natal body, by weight): ' +
        top.map((h) => `${h.transitBody}→${h.natalBody} ${h.type}`).join('; ') +
        '.'
    );
  }
  return lines.join('\n');
}
