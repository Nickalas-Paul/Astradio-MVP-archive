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

export function buildFeedCollapsedDisplayV1(weather: RelationalWeatherStateV1 | null | undefined): FeedCollapsedDisplayV1 {
  if (!weather) {
    return {
      primary_line: feedFallbackNoWeatherPrimary(),
      micro_tag: '',
      activation_descriptor: descriptorFromActivationMapped(null),
    };
  }
  const top = weather.aspects?.topCrossAspects?.[0];
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
