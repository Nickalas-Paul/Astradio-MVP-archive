/**
 * Phase 6D — Community Feed aspect insight bridge (library .feed only).
 */

import type { CrossAspectHitV1 } from '../../relational/weather/types';
import { buildAspectKey, getAspectInsight } from '../insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../insight-library/aspect-library-kill-list';
import { capToMaxSentences } from '../rule-layer/claim-synthesize';

export function feedAspectLibraryKey(hit: CrossAspectHitV1): string {
  return buildAspectKey(hit.transitBody, hit.natalBody, hit.type);
}

export function isFeedLibraryCovered(hit: CrossAspectHitV1): boolean {
  const key = feedAspectLibraryKey(hit);
  if (isAspectLibraryKillListed(key)) return false;
  const feed = getAspectInsight(key)?.feed?.trim();
  return Boolean(feed);
}

export function filterFeedLibraryCovered(hits: CrossAspectHitV1[]): CrossAspectHitV1[] {
  return hits.filter(isFeedLibraryCovered);
}

export function feedDisplayTextForHit(hit: CrossAspectHitV1): string {
  const key = feedAspectLibraryKey(hit);
  const feed = getAspectInsight(key)?.feed?.trim();
  if (!feed) {
    throw new Error(`feedDisplayTextForHit: missing library feed for ${key}`);
  }
  return capToMaxSentences(feed, 3);
}
