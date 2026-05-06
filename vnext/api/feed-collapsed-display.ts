/**
 * Presentation-only strings for Community Feed collapsed cards.
 * Uses existing RelationalWeatherStateV1 / cross-aspect data only — no new astrology logic.
 *
 * Phase 6D Beta — pair cards: fixed 3 activation lines (viewer / partner / shared) with deterministic fallbacks
 * when cross-aspect hits are sparse (weather does **not** guarantee a minimum hit count).
 */

import type { CrossAspectHitV1, RelationalWeatherStateV1 } from '../relational/weather/types';
import {
  buildCollapsedPrimaryLineFromHit,
  descriptorFromActivationMapped,
  fmtBody,
  feedFallbackNoAspectPrimary,
  feedFallbackNoWeatherPrimary,
} from '../projection/insight/map-insight-unit-v1';

const ASPECT_SYM: Record<CrossAspectHitV1['type'], string> = {
  conjunction: '☌',
  opposition: '☍',
  square: '□',
  trine: '△',
  sextile: '⚹',
};

export type FeedCollapsedDisplayV1 = {
  primary_line: string;
  micro_tag: string;
  activation_descriptor: string;
};

export type PairBetaMemberScope = 'you' | 'them' | 'shared';

/** Phase 6D Beta — optional extension on pair rows only (groups/campaigns omit). */
export type FeedCollapsedPairBetaV1 = {
  enhanced_title: string;
  /** Product: fixed “three highlights” model for Beta (not raw aspect tally). */
  activity_count: number;
  activation_lines: [
    { text: string; member_scope: 'you' },
    { text: string; member_scope: 'them' },
    { text: string; member_scope: 'shared' },
  ];
};

export type FeedCollapsedDisplayPairBetaV1 = FeedCollapsedDisplayV1 & FeedCollapsedPairBetaV1;

const ASPECT_VERB_YOU_THEM: Record<CrossAspectHitV1['type'], string> = {
  conjunction: 'conjuncts',
  opposition: 'opposes',
  square: 'squares',
  trine: 'trines',
  sextile: 'sextiles',
};

/** Neutral verb for shared / connection-level line (readable in isolation). */
const ASPECT_VERB_SHARED: Record<CrossAspectHitV1['type'], string> = {
  conjunction: 'merges into',
  opposition: 'polarizes',
  square: 'pressures',
  trine: 'eases',
  sextile: 'connects',
};

const MAX_LINE = 80;
const MAX_TITLE = 60;

function truncateAtWordBoundary(s: string, max: number): string {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const sp = slice.lastIndexOf(' ');
  if (sp > max * 0.5) return slice.slice(0, sp).trim() + '…';
  return slice.trim() + '…';
}

function formatYouThemLine(hit: CrossAspectHitV1, scope: 'you' | 'them'): string {
  const tv = fmtBody(hit.transitBody);
  const nv = fmtBody(hit.natalBody);
  const verb = ASPECT_VERB_YOU_THEM[hit.type] ?? 'aspects';
  const label = scope === 'you' ? 'YOUR' : 'THEIR';
  const raw = `${tv} ${verb} ${label} ${nv}`;
  return truncateAtWordBoundary(raw, MAX_LINE);
}

function formatSharedLineFromHit(hit: CrossAspectHitV1): string {
  const tv = fmtBody(hit.transitBody);
  const verb = ASPECT_VERB_SHARED[hit.type] ?? 'shapes';
  const raw = `${tv} ${verb} the connection`;
  return truncateAtWordBoundary(raw, MAX_LINE);
}

function fallbackLine(scope: 'you' | 'them' | 'shared', weather: RelationalWeatherStateV1 | null | undefined): string {
  if (scope === 'you') {
    const t = weather?.themes?.dominantThemes?.[0];
    if (t) return truncateAtWordBoundary(`Today's sky emphasizes YOUR chart (${t}).`, MAX_LINE);
    return truncateAtWordBoundary("Today's transits highlight YOUR side of the bond.", MAX_LINE);
  }
  if (scope === 'them') {
    const t = weather?.themes?.dominantThemes?.[0];
    if (t) return truncateAtWordBoundary(`The sky engages THEIR chart (${t}).`, MAX_LINE);
    return truncateAtWordBoundary("Transit sky reaches THEIR natal chart directly.", MAX_LINE);
  }
  const t = weather?.themes?.dominantThemes?.[0];
  if (t) return truncateAtWordBoundary(`${t} colors how you meet each other today.`, MAX_LINE);
  return truncateAtWordBoundary("Together you ride today's relational weather.", MAX_LINE);
}

export function buildEnhancedPairTitle(partnerDisplay: string, connectionLabelFallback: string): string {
  const partner = String(partnerDisplay || '').trim() || String(connectionLabelFallback || '').trim() || 'Partner';
  const raw = `Your relationship with ${partner}`;
  return truncateAtWordBoundary(raw, MAX_TITLE);
}

/**
 * Build three activation lines for a pair: viewer chart / partner chart / shared.
 * Priority: tightest orb (`orbDeg`) within each scope; shared = Option A — next best remaining hit by orb.
 * Fallbacks never leave a line empty (sparse transit days).
 */
export function buildPairActivationLinesBeta(input: {
  weather: RelationalWeatherStateV1 | null | undefined;
  topCrossAspects: CrossAspectHitV1[];
  viewerPrimaryChartId: string;
  partnerChartId: string;
}): FeedCollapsedPairBetaV1['activation_lines'] {
  const { weather, topCrossAspects, viewerPrimaryChartId, partnerChartId } = input;
  const seek = String(viewerPrimaryChartId || '').trim();
  const partner = String(partnerChartId || '').trim();
  const hits = Array.isArray(topCrossAspects) ? [...topCrossAspects] : [];

  const byOrb = (a: CrossAspectHitV1, b: CrossAspectHitV1) =>
    a.orbDeg !== b.orbDeg ? a.orbDeg - b.orbDeg : b.weight - a.weight;

  const youHits = hits.filter((h) => h.memberChartId === seek).sort(byOrb);
  const themHits = hits.filter((h) => h.memberChartId === partner).sort(byOrb);

  let lineYou: CrossAspectHitV1 | undefined = youHits[0];
  let lineThem: CrossAspectHitV1 | undefined = themHits[0];
  let lineShared: CrossAspectHitV1 | undefined;

  const usedKeys = new Set<string>();
  const keyOf = (h: CrossAspectHitV1) => `${h.transitBody}|${h.natalBody}|${h.type}|${h.memberChartId}`;
  if (lineYou) usedKeys.add(keyOf(lineYou));
  if (lineThem) usedKeys.add(keyOf(lineThem));

  const remaining = hits
    .filter((h) => !usedKeys.has(keyOf(h)))
    .sort(byOrb);
  lineShared = remaining[0];

  if (!lineYou) {
    lineYou = remaining.find((h) => h.memberChartId === seek) || youHits[0];
    if (lineYou) usedKeys.add(keyOf(lineYou));
  }
  if (!lineThem) {
    lineThem = remaining.find((h) => h.memberChartId === partner && !usedKeys.has(keyOf(h)));
    if (!lineThem) lineThem = themHits.find((h) => !usedKeys.has(keyOf(h)));
    if (lineThem) usedKeys.add(keyOf(lineThem));
  }
  if (!lineShared) {
    lineShared = remaining.sort(byOrb).find((h) => !usedKeys.has(keyOf(h)));
  }

  const textYou = lineYou ? formatYouThemLine(lineYou, 'you') : fallbackLine('you', weather);
  const textThem = lineThem ? formatYouThemLine(lineThem, 'them') : fallbackLine('them', weather);
  const textShared = lineShared ? formatSharedLineFromHit(lineShared) : fallbackLine('shared', weather);

  return [
    { text: textYou, member_scope: 'you' },
    { text: textThem, member_scope: 'them' },
    { text: textShared, member_scope: 'shared' },
  ];
}

export function buildFeedCollapsedDisplayPairBetaV1(input: {
  weather: RelationalWeatherStateV1 | null | undefined;
  displayHit: CrossAspectHitV1 | null | undefined;
  viewerPrimaryChartId: string;
  partnerChartId: string;
  partnerChartLabel: string;
  connectionLabelFallback: string;
}): FeedCollapsedDisplayPairBetaV1 {
  const v1 = buildFeedCollapsedDisplayV1(input.weather, input.displayHit);
  const lines = buildPairActivationLinesBeta({
    weather: input.weather,
    topCrossAspects: input.weather?.aspects?.topCrossAspects ?? [],
    viewerPrimaryChartId: input.viewerPrimaryChartId,
    partnerChartId: input.partnerChartId,
  });
  const enhanced_title = buildEnhancedPairTitle(input.partnerChartLabel, input.connectionLabelFallback);
  return {
    ...v1,
    enhanced_title,
    activity_count: 3,
    activation_lines: lines,
  };
}

function resolveHitForDisplay(
  weather: RelationalWeatherStateV1,
  displayHit: CrossAspectHitV1 | null | undefined
): CrossAspectHitV1 | undefined {
  const list = weather.aspects?.topCrossAspects;
  if (!list?.length) return undefined;
  if (!displayHit) return list[0];
  const want = `${displayHit.transitBody}|${displayHit.natalBody}|${displayHit.type}`;
  return list.find((h) => `${h.transitBody}|${h.natalBody}|${h.type}` === want) ?? list[0];
}

/**
 * @param displayHit Optional hit from `weather.aspects.topCrossAspects` (matched by transit|natal|type).
 *                  When omitted, uses topCrossAspects[0] (legacy behavior).
 */
export function buildFeedCollapsedDisplayV1(
  weather: RelationalWeatherStateV1 | null | undefined,
  displayHit?: CrossAspectHitV1 | null
): FeedCollapsedDisplayV1 {
  if (!weather) {
    return {
      primary_line: feedFallbackNoWeatherPrimary(),
      micro_tag: '',
      activation_descriptor: descriptorFromActivationMapped(null),
    };
  }
  const top = resolveHitForDisplay(weather, displayHit);
  const act = weather.activation;
  const activation_descriptor = descriptorFromActivationMapped(act);
  if (!top) {
    return {
      primary_line: feedFallbackNoAspectPrimary(),
      micro_tag: '',
      activation_descriptor,
    };
  }
  const tb = fmtBody(top.transitBody);
  const nb = fmtBody(top.natalBody);
  return {
    primary_line: buildCollapsedPrimaryLineFromHit(top),
    micro_tag: `${tb} ${ASPECT_SYM[top.type] ?? '·'} ${nb}`.trim(),
    activation_descriptor,
  };
}
