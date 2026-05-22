/**
 * Presentation-only strings for Community Feed collapsed cards.
 * Phase 6D — library .feed text only (no template aspect lines).
 */

import type { CrossAspectHitV1, RelationalWeatherStateV1 } from '../relational/weather/types';
import { descriptorFromActivationMapped, fmtBody } from '../projection/insight/map-insight-unit-v1';
import { feedDisplayTextForHit } from '../projection/insight/feed-aspect-insight-v1';

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

/** Phase 6D Beta — pair-only; exactly three library activation lines. */
export type FeedCollapsedPairBetaV1 = {
  enhanced_title: string;
  activity_count: 3;
  activation_lines: [{ text: string }, { text: string }, { text: string }];
};

export type FeedCollapsedDisplayPairBetaV1 = FeedCollapsedDisplayV1 & FeedCollapsedPairBetaV1;

const MAX_TITLE = 60;

function truncateAtWordBoundary(s: string, max: number): string {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const sp = slice.lastIndexOf(' ');
  if (sp > max * 0.5) return slice.slice(0, sp).trim() + '…';
  return slice.trim() + '…';
}

export function buildMicroTagFromHit(hit: CrossAspectHitV1): string {
  const tb = fmtBody(hit.transitBody);
  const nb = fmtBody(hit.natalBody);
  return `${tb} ${ASPECT_SYM[hit.type] ?? '·'} ${nb}`.trim();
}

export function buildEnhancedPairTitle(partnerDisplay: string, connectionLabelFallback: string): string {
  const partner = String(partnerDisplay || '').trim() || String(connectionLabelFallback || '').trim() || 'Partner';
  const raw = `Your relationship with ${partner}`;
  return truncateAtWordBoundary(raw, MAX_TITLE);
}

export function buildFeedActivationLinesFromHits(
  hits: CrossAspectHitV1[]
): FeedCollapsedPairBetaV1['activation_lines'] {
  if (hits.length !== 3) {
    throw new Error(`buildFeedActivationLinesFromHits: expected 3 hits, got ${hits.length}`);
  }
  return [
    { text: feedDisplayTextForHit(hits[0]!) },
    { text: feedDisplayTextForHit(hits[1]!) },
    { text: feedDisplayTextForHit(hits[2]!) },
  ];
}

export function buildFeedCollapsedDisplayPairBetaV1(input: {
  weather: RelationalWeatherStateV1 | null | undefined;
  cardHits: CrossAspectHitV1[];
  partnerChartLabel: string;
  connectionLabelFallback: string;
}): FeedCollapsedDisplayPairBetaV1 {
  if (input.cardHits.length !== 3) {
    throw new Error(`buildFeedCollapsedDisplayPairBetaV1: expected 3 cardHits, got ${input.cardHits.length}`);
  }
  const hero = input.cardHits[0]!;
  const v1 = buildFeedCollapsedDisplayV1(input.weather, hero);
  const enhanced_title = buildEnhancedPairTitle(input.partnerChartLabel, input.connectionLabelFallback);
  return {
    ...v1,
    enhanced_title,
    activity_count: 3,
    activation_lines: buildFeedActivationLinesFromHits(input.cardHits),
  };
}

/**
 * @param displayHit Library-covered hit for this row (group hero aspect).
 */
export function buildFeedCollapsedDisplayV1(
  weather: RelationalWeatherStateV1 | null | undefined,
  displayHit: CrossAspectHitV1
): FeedCollapsedDisplayV1 {
  const activation_descriptor = descriptorFromActivationMapped(weather?.activation ?? null);
  return {
    primary_line: feedDisplayTextForHit(displayHit),
    micro_tag: buildMicroTagFromHit(displayHit),
    activation_descriptor,
  };
}
