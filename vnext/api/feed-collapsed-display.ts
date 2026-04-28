/**
 * Presentation-only strings for Community Feed collapsed cards.
 * Uses existing RelationalWeatherStateV1 / cross-aspect data only — no new astrology logic.
 */

import type { CrossAspectHitV1, RelationalWeatherStateV1 } from '../relational/weather/types';

function fmtBody(name: string): string {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return '';
  return n.charAt(0).toUpperCase() + n.slice(1);
}

const ASPECT_LABEL: Record<CrossAspectHitV1['type'], string> = {
  conjunction: 'conjunct',
  opposition: 'opposite',
  square: 'square',
  trine: 'trine',
  sextile: 'sextile',
};

const ASPECT_SYM: Record<CrossAspectHitV1['type'], string> = {
  conjunction: '☌',
  opposition: '☍',
  square: '□',
  trine: '△',
  sextile: '⚹',
};

function dynamicsClause(d: CrossAspectHitV1['dynamics']): string {
  switch (d) {
    case 'tense':
      return 'is sharpening how you respond to each other right now';
    case 'supportive':
      return 'is easing how you work together right now';
    case 'flowing':
      return 'keeps contact workable between you right now';
    case 'polarizing':
      return 'pulls you toward contrasting instincts in this connection';
    case 'amplifying':
    default:
      return 'intensifies what is already in motion between you right now';
  }
}

function descriptorFromActivation(a: RelationalWeatherStateV1['activation']): string {
  const scores: { k: string; v: number }[] = [
    { k: 'emotional', v: a.emotional_activation },
    { k: 'friction', v: a.friction },
    { k: 'harmony', v: a.harmony },
    { k: 'intensity', v: a.intensity },
    { k: 'communication', v: a.communication_emphasis },
    { k: 'volatility', v: a.volatility },
    { k: 'growth', v: a.growth_pressure },
  ];
  scores.sort((x, y) => y.v - x.v);
  const top = scores[0]!;
  if (top.v < 0.2) return 'Subtle but present between you';
  if (top.k === 'emotional' && top.v >= 0.45) return 'High emotional activation';
  if (top.k === 'friction' && top.v >= 0.45) return 'Pressure building';
  if (top.k === 'harmony' && top.v >= 0.45) return 'Strong cooperation signal';
  if (top.k === 'intensity' && top.v >= 0.45) return 'Heightened contact';
  if (top.k === 'communication' && top.v >= 0.4) return 'Communication in focus';
  if (top.k === 'volatility' && top.v >= 0.35) return 'Quick shifts in tone';
  if (top.k === 'growth' && top.v >= 0.35) return 'Change pressure in the mix';
  return 'Active between you';
}

export type FeedCollapsedDisplayV1 = {
  primary_line: string;
  micro_tag: string;
  activation_descriptor: string;
};

export function buildFeedCollapsedDisplayV1(weather: RelationalWeatherStateV1 | null | undefined): FeedCollapsedDisplayV1 {
  if (!weather) {
    return {
      primary_line: 'This connection is registering in your feed for this moment.',
      micro_tag: '',
      activation_descriptor: 'Active between you',
    };
  }
  const top = weather.aspects?.topCrossAspects?.[0];
  const act = weather.activation;
  const activation_descriptor = descriptorFromActivation(act);
  if (!top) {
    return {
      primary_line: 'This connection is active in your feed for this moment.',
      micro_tag: '',
      activation_descriptor,
    };
  }
  const tb = fmtBody(top.transitBody);
  const nb = fmtBody(top.natalBody);
  const aspectWord = ASPECT_LABEL[top.type] ?? 'aspect';
  return {
    primary_line: `${tb} ${aspectWord} ${nb} ${dynamicsClause(top.dynamics)}.`,
    micro_tag: `${tb} ${ASPECT_SYM[top.type] ?? '·'} ${nb}`.trim(),
    activation_descriptor,
  };
}
