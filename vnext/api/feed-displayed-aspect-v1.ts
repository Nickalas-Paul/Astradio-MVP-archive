/**
 * Deterministic feed-level display aspect selection (diversity scope only).
 * Does not alter weather computation, ranking, or aspect ordering inside topCrossAspects.
 */

import type { CrossAspectHitV1 } from '../relational/weather/types';

export const FEED_DISPLAY_DIVERSITY_ROW_CAP = 10;
export const FEED_DISPLAY_MAX_REPEAT_WINDOW = 3;

/** Display diversity key — transitBody | natalBody | type (no prose). */
export function feedDisplayedAspectKey(hit: CrossAspectHitV1): string {
  return `${hit.transitBody}|${hit.natalBody}|${hit.type}`;
}

/**
 * Pick which hit to show for row `sortedIndex` (0-based along already-sorted feed).
 * Rows sortedIndex >= N always use hits[0] and do not mutate recentKeyWindow.
 */
export function selectDisplayedFeedAspectForSortedRow(input: {
  sortedIndex: number;
  hits: CrossAspectHitV1[];
  recentKeyWindow: readonly string[];
}): { readonly hit: CrossAspectHitV1; readonly nextWindow: string[] } {
  const { sortedIndex, hits, recentKeyWindow } = input;
  if (!hits.length) {
    throw new Error('selectDisplayedFeedAspectForSortedRow: empty hits');
  }
  const top = hits[0]!;
  if (sortedIndex >= FEED_DISPLAY_DIVERSITY_ROW_CAP) {
    return { hit: top, nextWindow: [...recentKeyWindow] };
  }
  const recentSet = new Set(recentKeyWindow);
  const hit = hits.find((h) => !recentSet.has(feedDisplayedAspectKey(h))) ?? top;
  const k = feedDisplayedAspectKey(hit);
  const next = [...recentKeyWindow, k];
  while (next.length > FEED_DISPLAY_MAX_REPEAT_WINDOW) next.shift();
  return { hit, nextWindow: next };
}
