/**
 * Deterministic feed-level display aspect selection (full-feed sliding window).
 * Does not alter weather computation, ranking, or aspect ordering inside topCrossAspects.
 */

import type { CrossAspectHitV1 } from '../relational/weather/types';

export const FEED_DISPLAY_MAX_REPEAT_WINDOW = 3;

/** Display diversity key — transitBody | natalBody | type (no prose). */
export function feedDisplayedAspectKey(hit: CrossAspectHitV1): string {
  return `${hit.transitBody}|${hit.natalBody}|${hit.type}`;
}

/**
 * Pick which hit to show for this feed row (after ranking order is fixed).
 * Scans hits in existing sorted order; first hit whose display key is not in the
 * last W keys; if none, fallback to hits[0].
 *
 * Callers must pass a non-empty list pre-filtered with `filterFeedLibraryCovered`
 * (typically from `feedCandidateAspects`).
 */
export function selectDisplayedFeedAspectForSortedRow(input: {
  hits: CrossAspectHitV1[];
  recentKeyWindow: readonly string[];
}): { readonly hit: CrossAspectHitV1; readonly nextWindow: string[] } {
  const { hits, recentKeyWindow } = input;
  if (!hits.length) {
    throw new Error('selectDisplayedFeedAspectForSortedRow: empty hits');
  }
  const top = hits[0]!;
  const recentSet = new Set(recentKeyWindow);
  const hit = hits.find((h) => !recentSet.has(feedDisplayedAspectKey(h))) ?? top;
  const k = feedDisplayedAspectKey(hit);
  const next = [...recentKeyWindow, k];
  while (next.length > FEED_DISPLAY_MAX_REPEAT_WINDOW) next.shift();
  return { hit, nextWindow: next };
}
