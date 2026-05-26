/**
 * Phase 6D / 8A-Delta — Feed card aspect selection (library-covered, role-balanced triple for pairs).
 */

import type { CrossAspectHitV1 } from '../relational/weather/types';
import { filterFeedLibraryCovered } from '../projection/insight/feed-aspect-insight-v1';
import {
  feedDisplayedAspectKey,
  FEED_DISPLAY_MAX_REPEAT_WINDOW,
} from './feed-displayed-aspect-v1';

export const FEED_CARD_ASPECT_COUNT = 3 as const;

export type FeedHitRole = 'you_bring' | 'they_bring' | 'tests_both';

export type CategorizedFeedHit = CrossAspectHitV1 & { role: FeedHitRole };

const ROLE_ORDER: FeedHitRole[] = ['you_bring', 'they_bring', 'tests_both'];

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

function pickFirstDistinct(
  pool: CategorizedFeedHit[],
  recent: Set<string>,
  used: Set<string>
): CategorizedFeedHit | undefined {
  for (const h of pool) {
    const k = feedDisplayedAspectKey(h);
    if (used.has(k)) continue;
    if (recent.has(k)) continue;
    return h;
  }
  for (const h of pool) {
    const k = feedDisplayedAspectKey(h);
    if (used.has(k)) continue;
    return h;
  }
  return undefined;
}

export function determineFeedHitRole(
  hit: CrossAspectHitV1,
  viewerChartId: string,
  partnerChartId: string
): FeedHitRole {
  const isChallengingAspect = hit.type === 'square' || hit.type === 'opposition';
  const isFriction = hit.dynamics === 'tense' || hit.dynamics === 'polarizing';

  if (isChallengingAspect || isFriction) {
    return 'tests_both';
  }

  if (hit.memberChartId === partnerChartId) {
    return 'you_bring';
  }

  if (hit.memberChartId === viewerChartId) {
    return 'they_bring';
  }

  return 'you_bring';
}

function categorizeFeedHits(
  hits: CrossAspectHitV1[],
  viewerChartId: string,
  partnerChartId: string
): CategorizedFeedHit[] {
  return hits.map((hit) => ({
    ...hit,
    role: determineFeedHitRole(hit, viewerChartId, partnerChartId),
  }));
}

function sortByRoleOrder(hits: CategorizedFeedHit[]): CategorizedFeedHit[] {
  const order: Record<FeedHitRole, number> = { you_bring: 0, they_bring: 1, tests_both: 2 };
  return [...hits].sort((a, b) => order[a.role] - order[b.role]);
}

function selectBestPerRole(
  categorized: CategorizedFeedHit[],
  recentKeyWindow: readonly string[] | undefined
): CategorizedFeedHit[] {
  const recent = new Set(recentKeyWindow ?? []);
  const picked: CategorizedFeedHit[] = [];
  const used = new Set<string>();

  for (const role of ROLE_ORDER) {
    const pool = categorized.filter((h) => h.role === role).sort(compareFeedHitPriority);
    const hit = pickFirstDistinct(pool, recent, used);
    if (hit) {
      picked.push(hit);
      used.add(feedDisplayedAspectKey(hit));
    }
  }

  if (picked.length < FEED_CARD_ASPECT_COUNT) {
    const rest = [...categorized].sort(compareFeedHitPriority);
    for (const h of rest) {
      if (picked.length >= FEED_CARD_ASPECT_COUNT) break;
      const k = feedDisplayedAspectKey(h);
      if (used.has(k)) continue;
      picked.push(h);
      used.add(k);
    }
  }

  return sortByRoleOrder(picked.slice(0, FEED_CARD_ASPECT_COUNT));
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
  viewerChartId?: string;
  partnerChartId?: string;
}): CategorizedFeedHit[] {
  const covered = filterFeedLibraryCovered(input.hits);

  const byKey = new Map<string, CrossAspectHitV1>();
  for (const h of [...covered].sort(compareFeedHitPriority)) {
    const k = feedDisplayedAspectKey(h);
    if (!byKey.has(k)) {
      byKey.set(k, h);
    }
  }

  const candidates = [...byKey.values()].sort(compareFeedHitPriority);
  const viewer = String(input.viewerChartId || '').trim();
  const partner = String(input.partnerChartId || '').trim();

  if (!viewer || !partner) {
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
    return picked.slice(0, FEED_CARD_ASPECT_COUNT).map((h) => ({ ...h, role: 'you_bring' as const }));
  }

  const categorized = categorizeFeedHits(candidates, viewer, partner);
  let picked = selectBestPerRole(categorized, input.recentKeyWindow);

  if (picked.length < FEED_CARD_ASPECT_COUNT) {
    picked = selectBestPerRole(categorized, []);
  }

  if (picked.length < FEED_CARD_ASPECT_COUNT) {
    throw new FeedAspectCoverageInvariantError({
      feedItemId: input.feedItemId,
      poolSize: input.hits.length,
      coveredUnique: byKey.size,
      picked: picked.length,
    });
  }

  return picked;
}
