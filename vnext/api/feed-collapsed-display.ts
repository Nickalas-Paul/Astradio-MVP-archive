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

/** Deterministic clause keyed only by aspect geometry + dynamics (existing fields). */
const PRIMARY_LINE_BY_TYPE_AND_DYNAMICS: Record<
  CrossAspectHitV1['type'],
  Record<CrossAspectHitV1['dynamics'], string>
> = {
  conjunction: {
    amplifying:
      '{aspect} brings attention to what gets said, clarified, or misunderstood between you.',
    supportive: '{aspect} makes agreement easier—shared signals land cleanly between you.',
    tense: '{aspect} tightens focus—small disagreements can feel personal unless you slow down.',
    flowing: '{aspect} keeps contact workable—what you notice lines up without extra effort.',
    polarizing: '{aspect} pulls instincts apart—you may want opposite things at the same time.',
  },
  opposition: {
    amplifying: '{aspect} puts the bond in plain view—needs on both sides feel visible and urgent.',
    supportive: '{aspect} helps you meet in the middle without one person carrying the repair.',
    tense: '{aspect} sharpens contrast—balance shows up as tension until it is named.',
    flowing: '{aspect} lets you trade perspectives without forcing a winner.',
    polarizing: '{aspect} swings between poles—watch for all‑or‑nothing framing.',
  },
  square: {
    amplifying:
      '{aspect} puts tone and wording under pressure—small misunderstandings can read larger than intended.',
    supportive: '{aspect} still moves things forward—friction becomes workable when you stay concrete.',
    tense: '{aspect} asks for patience—pressure rises when assumptions stay unspoken.',
    flowing: '{aspect} keeps you engaged—you sort differences by staying in contact.',
    polarizing: '{aspect} escalates quickly—pause before you interpret intent.',
  },
  trine: {
    amplifying: '{aspect} lifts what already works—ease between you shows up without forcing it.',
    supportive: '{aspect} smooths cooperation—good timing for aligned action.',
    tense: '{aspect} rarely bites hard—still check that ease does not skip needed honesty.',
    flowing: '{aspect} carries rhythm—support flows with little friction.',
    polarizing: '{aspect} can hide mismatch behind comfort—say the quiet part once.',
  },
  sextile: {
    amplifying: '{aspect} opens helpful side doors—small openings matter more than big speeches.',
    supportive: '{aspect} favors practical fixes—short exchanges move things.',
    tense: '{aspect} adds mild edges—keep asks simple so nothing feels like a lecture.',
    flowing: '{aspect} keeps dialogue nimble—you can adjust course without drama.',
    polarizing: '{aspect} flickers between helpful and distracting—pick one thread and finish it.',
  },
};

function aspectPhrase(tb: string, nb: string, type: CrossAspectHitV1['type']): string {
  const aspectWord = ASPECT_LABEL[type] ?? 'aspect';
  return `${tb} ${aspectWord} ${nb}`;
}

function primaryLineFromAspect(top: CrossAspectHitV1): string {
  const tb = fmtBody(top.transitBody);
  const nb = fmtBody(top.natalBody);
  const phrase = aspectPhrase(tb, nb, top.type);
  const byType = PRIMARY_LINE_BY_TYPE_AND_DYNAMICS[top.type];
  const tpl = byType?.[top.dynamics] ?? byType?.amplifying ?? PRIMARY_LINE_BY_TYPE_AND_DYNAMICS.conjunction.amplifying;
  return tpl.replace(/\{aspect\}/g, phrase);
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
  scores.sort((x, y) => y.v - x.v || x.k.localeCompare(y.k));
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
  return {
    primary_line: primaryLineFromAspect(top),
    micro_tag: `${tb} ${ASPECT_SYM[top.type] ?? '·'} ${nb}`.trim(),
    activation_descriptor,
  };
}
