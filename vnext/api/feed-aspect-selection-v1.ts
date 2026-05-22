/**
 * Phase 6D — Feed card aspect selection (library-covered only, strict 3-aspect guarantee for pairs).
 */

import type { CrossAspectHitV1 } from '../relational/weather/types';
import { filterFeedLibraryCovered } from '../projection/insight/feed-aspect-insight-v1';
import {
  feedDisplayedAspectKey,
  FEED_DISPLAY_MAX_REPEAT_WINDOW,
} from './feed-displayed-aspect-v1';

export const FEED_CARD_ASPECT_COUNT = 3 as const;

export type FeedAspectCoverageInvariantContext = {
  feedItemId: string;
  poolSize: number;
  coveredUnique: number;
  picked: number;
};

export class FeedAspectCoverageInvariantError extends Error {
  readonly code = 'FEED_ASPECT_COVERAGE_INVARIANT';
  readonly context: FeedAspectCoverageInvariantContext;

  constructor(context: FeedAspectCoverageInvariantContext) {
    super(
      `Feed aspect coverage invariant: need ${FEED_CARD_ASPECT_COUNT} distinct library-covered aspects, got ${context.picked} (pool=${context.poolSize}, unique=${context.coveredUnique})`
    );
    this.name = 'FeedAspectCoverageInvariantError';
    this.context = context;
  }
}

const PERSONAL = new Set(['sun', 'moon', 'mercury', 'venus', 'mars']);
const SOCIAL = new Set(['jupiter', 'saturn']);

function transitPlanetTier(hit: CrossAspectHitV1): 0 | 1 | 2 {
  const t = hit.transitBody.toLowerCase();
  if (PERSONAL.has(t)) return 0;
  if (SOCIAL.has(t)) return 1;
  return 2;
}

export function compareFeedHitPriority(a: CrossAspectHitV1, b: CrossAspectHitV1): number {
  const ta = transitPlanetTier(a);
  const tb = transitPlanetTier(b);
  if (ta !== tb) return ta - tb;
  if (b.weight !== a.weight) return b.weight - a.weight;
  if (a.orbDeg !== b.orbDeg) return a.orbDeg - b.orbDeg;
  return feedDisplayedAspectKey(a).localeCompare(feedDisplayedAspectKey(b), 'en');
}

function pickDistinctKeys(
  candidates: CrossAspectHitV1[],
  maxCount: number,
  recentKeyWindow: readonly string[] | undefined
): CrossAspectHitV1[] {
  const recent = new Set(recentKeyWindow ?? []);
  const picked: CrossAspectHitV1[] = [];
  const used = new Set<string>();

  for (const h of candidates) {
    if (picked.length >= maxCount) break;
    const k = feedDisplayedAspectKey(h);
    if (used.has(k)) continue;
    if (recent.has(k)) continue;
    picked.push(h);
    used.add(k);
  }

  for (const h of candidates) {
    if (picked.length >= maxCount) break;
    const k = feedDisplayedAspectKey(h);
    if (used.has(k)) continue;
    picked.push(h);
    used.add(k);
  }

  return picked;
}

/** Advance sliding window after a pair card selects up to 3 aspects. */
export function pushKeysToWindow(
  recentKeyWindow: readonly string[],
  hits: readonly CrossAspectHitV1[]
): string[] {
  const next = [...recentKeyWindow];
  for (const h of hits) {
    const k = feedDisplayedAspectKey(h);
    next.push(k);
    while (next.length > FEED_DISPLAY_MAX_REPEAT_WINDOW) next.shift();
  }
  return next;
}

export function selectFeedAspectsForCard(input: {
  hits: CrossAspectHitV1[];
  feedItemId: string;
  recentKeyWindow?: readonly string[];
}): CrossAspectHitV1[] {
  const covered = filterFeedLibraryCovered(input.hits);

  const byKey = new Map<string, CrossAspectHitV1>();
  for (const h of [...covered].sort(compareFeedHitPriority)) {
    const k = feedDisplayedAspectKey(h);
    if (!byKey.has(k)) {
      byKey.set(k, h);
    }
  }

  const candidates = [...byKey.values()].sort(compareFeedHitPriority);

  let picked = pickDistinctKeys(candidates, FEED_CARD_ASPECT_COUNT, input.recentKeyWindow);

  if (picked.length < FEED_CARD_ASPECT_COUNT) {
    picked = pickDistinctKeys(candidates, FEED_CARD_ASPECT_COUNT, []);
  }

  if (picked.length < FEED_CARD_ASPECT_COUNT) {
    throw new FeedAspectCoverageInvariantError({
      feedItemId: input.feedItemId,
      poolSize: input.hits.length,
      coveredUnique: byKey.size,
      picked: picked.length,
    });
  }

  return picked.slice(0, FEED_CARD_ASPECT_COUNT);
}
