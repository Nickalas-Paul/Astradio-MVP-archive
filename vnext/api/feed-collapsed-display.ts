/**
 * Presentation-only strings for Community Feed collapsed cards.
 * Uses existing RelationalWeatherStateV1 / cross-aspect data only — no new astrology logic.
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
