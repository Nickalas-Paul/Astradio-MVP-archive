/**
 * Phase 6D / 8A-Delta — Community Feed aspect insight (directional synastry + feed fallback).
 */

import type { CrossAspectHitV1 } from '../../relational/weather/types';
import type { CategorizedFeedHit } from '../../api/feed-aspect-selection-v1';
import { buildAspectKey, getAspectInsight } from '../insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../insight-library/aspect-library-kill-list';
import { capToMaxSentences } from '../rule-layer/claim-synthesize';
import { fmtBody } from './map-insight-unit-v1';

export function feedAspectLibraryKey(hit: CrossAspectHitV1): string {
  return buildAspectKey(hit.transitBody, hit.natalBody, hit.type);
}

function synastryProseForHit(hit: CrossAspectHitV1, intent: 'friend' | 'partner' = 'friend'): string | undefined {
  const insight = getAspectInsight(feedAspectLibraryKey(hit));
  if (!insight) return undefined;
  const prose =
    (intent === 'partner' ? insight.romantic_synastry : insight.friendship_synastry) ??
    insight.behavioral_synastry ??
    insight.core_synastry;
  const trimmed = typeof prose === 'string' ? prose.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isFeedLibraryCovered(hit: CrossAspectHitV1): boolean {
  const key = feedAspectLibraryKey(hit);
  if (isAspectLibraryKillListed(key)) return false;
  if (synastryProseForHit(hit)) return true;
  const feed = getAspectInsight(key)?.feed?.trim();
  return Boolean(feed);
}

export function filterFeedLibraryCovered(hits: CrossAspectHitV1[]): CrossAspectHitV1[] {
  return hits.filter(isFeedLibraryCovered);
}

export function planetDisplayName(body: string): string {
  return fmtBody(body);
}

const ASPECT_VERB: Record<CrossAspectHitV1['type'], string> = {
  conjunction: 'conjuncts',
  opposition: 'opposes',
  square: 'squares',
  trine: 'trines',
  sextile: 'sextiles',
};

export function aspectDisplayName(type: CrossAspectHitV1['type']): string {
  return ASPECT_VERB[type] ?? 'aspects';
}

function pickSynastrySentences(prose: string, hit: CrossAspectHitV1): string {
  const sentences = prose.split(/\.\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return '';

  const firstSentence = sentences[0] || '';
  const isTechnicalLabel =
    /are (sextile|trine|square|opposition|conjunct)/i.test(firstSentence) ||
    /Your \w+ and their \w+ are (sextile|trine|square|opposition|conjunct)/i.test(firstSentence) ||
    /sixty degrees apart|ninety degrees apart|one hundred twenty degrees/i.test(firstSentence) ||
    /in the same element(al family)?/i.test(firstSentence);

  let startIdx = 0;
  if (isTechnicalLabel && sentences.length > 1) {
    startIdx = 1;
  }

  const slice = sentences.slice(startIdx, startIdx + 2);
  let selected = slice.join('. ').trim();
  if (selected && !selected.endsWith('.')) selected += '.';
  return selected;
}

export function buildDirectionalPrefix(hit: CategorizedFeedHit): string {
  const transitName = planetDisplayName(hit.transitBody);
  const natalName = planetDisplayName(hit.natalBody);
  const aspectName = aspectDisplayName(hit.type);

  if (hit.role === 'you_bring') {
    return `Your transiting ${transitName} ${aspectName} their natal ${natalName}`;
  }
  if (hit.role === 'they_bring') {
    return `Their transiting ${transitName} ${aspectName} your natal ${natalName}`;
  }
  return `Transiting ${transitName} ${aspectName} natal ${natalName}`;
}

export function composeFeedActivationLine(
  hit: CategorizedFeedHit,
  _viewerChartId: string,
  _partnerChartId: string,
  intent: 'friend' | 'partner' = 'friend'
): string {
  const prefix = buildDirectionalPrefix(hit);
  const prose = synastryProseForHit(hit, intent);

  if (!prose) {
    const transitName = planetDisplayName(hit.transitBody);
    const natalName = planetDisplayName(hit.natalBody);
    const aspectName = aspectDisplayName(hit.type);
    return `Transiting ${transitName} ${aspectName} natal ${natalName} in this connection today.`;
  }

  const selectedSentences = pickSynastrySentences(prose, hit);
  if (!selectedSentences) {
    return `${prefix} in this connection today.`;
  }

  return `${prefix}—${selectedSentences}`;
}

/** Group / single-hit cards — generic feed field copy. */
export function feedDisplayTextForHit(hit: CrossAspectHitV1): string {
  const key = feedAspectLibraryKey(hit);
  const feed = getAspectInsight(key)?.feed?.trim();
  if (!feed) {
    throw new Error(`feedDisplayTextForHit: missing library feed for ${key}`);
  }
  return capToMaxSentences(feed, 3);
}
