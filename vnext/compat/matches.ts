/**
 * Compatibility matches: ranking adapter over the canonical compatibility field.
 * No independent scoring logic lives here.
 */

import { getChartById, getChartSnapshotCached } from './chart-store';
import * as storage from './storage';
import type { DirectoryEligibleUser } from './storage';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import type { AspectInsight } from '../projection/insight-library/insight-library-types';
import { isAspectLibraryKillListed } from '../projection/insight-library/aspect-library-kill-list';
import type { DirectedSnapshotAspect } from '../synastry/synastry-types';
import type { EphemerisSnapshot } from '../contracts';
import { compatibilityFacetExplanation } from '../projection/insight/map-insight-unit-v1';
import { computeCompatibilitySystem } from '../compatibility/service';
import type { RelationalFieldScoreContract } from '../compatibility/contracts';
import type { RelationalIntent } from '../compatibility/relational-intent';
import { canonicalIntentRank } from '../compatibility/intent-rank';
import type { DiscoveryTransitInput } from '../compatibility/daily-transit-cache';
import { warmDailyTransitCache } from '../compatibility/daily-transit-cache';
import {
  blendDiscoveryDailyScore,
  computeTransitAmplification,
  resolveSeekerTransitInput,
} from '../compatibility/transit-amplification';
import type { TransitAmplificationResult } from '../compatibility/transit-amplification';
import type { CompatibilityExplanationProfilePublic } from '../compatibility/discovery-explanation';
import { findBestDirectedCrossAspect } from '../synastry/cross-chart-best-aspect';

/** FNV-1a 32-bit hash for deterministic chart-pair seeding (Phase 2 diversity). */
export function hash32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** @deprecated Use RelationalIntent from ../compatibility/relational-intent */
export type CompatMatchMode = RelationalIntent;

/** Server-only; removed from GET /compat/matches JSON. */
export type CompatMatchTransitMeta = {
  topHits: TransitAmplificationResult['topHits'];
};

export type TransitFramingHit = {
  transitBody: string;
  natalBody: string;
  aspectType: string;
};

/**
 * Cap bullet text at maxLength for Discovery display; prefer sentence boundaries.
 */
export function capBulletText(text: string, maxLength = 280): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

  if (lastSentenceEnd > maxLength * 0.7) {
    return text.slice(0, lastSentenceEnd + 1).trim();
  }

  return `${truncated.trim()}…`;
}

export function findRelevantTransitHit(
  aspect: DirectedSnapshotAspect | undefined,
  hits: TransitFramingHit[],
  excludeHits: TransitFramingHit[] = []
): TransitFramingHit | undefined {
  if (!aspect || !hits.length) {
    return undefined;
  }

  const bodyA = String(aspect.bodyA).toLowerCase();
  const bodyB = String(aspect.bodyB).toLowerCase();
  const excludeSet = new Set(excludeHits);

  return hits.find((hit) => {
    if (excludeSet.has(hit)) return false;
    const natalBody = String(hit.natalBody).toLowerCase();
    return natalBody === bodyA || natalBody === bodyB;
  });
}

/**
 * Use library `feed` when today's transit hits a body in the synastry pair; else timeless prose.
 */
export function resolveTransitAwareBulletText(params: {
  aspect: DirectedSnapshotAspect | undefined;
  insight: AspectInsight | null | undefined;
  transitHit?: TransitFramingHit;
  timelessText: string;
}): string {
  const { aspect, insight, transitHit, timelessText } = params;

  if (!insight || !aspect) {
    return timelessText;
  }

  const bodyA = String(aspect.bodyA).toLowerCase();
  const bodyB = String(aspect.bodyB).toLowerCase();
  const hitNatalBody = transitHit?.natalBody ? String(transitHit.natalBody).toLowerCase() : '';
  const hitMatchesAspect = hitNatalBody && (hitNatalBody === bodyA || hitNatalBody === bodyB);

  if (hitMatchesAspect && insight.feed?.trim()) {
    return capBulletText(insight.feed.trim());
  }

  return timelessText;
}

export function applyTransitFeedToSynastryBullets(
  bullets: {
    forThem: { anchor: string; text: string };
    forYou: { anchor: string; text: string };
    together: { anchor: string; text: string };
  },
  aspects: {
    forThem?: DirectedSnapshotAspect;
    forYou?: DirectedSnapshotAspect;
    together?: DirectedSnapshotAspect;
  },
  transitMeta?: CompatMatchTransitMeta
): typeof bullets {
  if (!transitMeta?.topHits?.length) {
    return bullets;
  }

  const hits: TransitFramingHit[] = transitMeta.topHits.map((h) => ({
    transitBody: h.transitBody,
    natalBody: h.natalBody,
    aspectType: h.aspectType,
  }));

  const forThemHit = findRelevantTransitHit(aspects.forThem, hits);
  const forYouHit = findRelevantTransitHit(aspects.forYou, hits, forThemHit ? [forThemHit] : []);

  const insightFor = (aspect?: DirectedSnapshotAspect) =>
    aspect ? getAspectInsight(buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type)) : undefined;

  return {
    forThem: {
      ...bullets.forThem,
      text: resolveTransitAwareBulletText({
        aspect: aspects.forThem,
        insight: insightFor(aspects.forThem),
        transitHit: forThemHit,
        timelessText: bullets.forThem.text,
      }),
    },
    forYou: {
      ...bullets.forYou,
      text: resolveTransitAwareBulletText({
        aspect: aspects.forYou,
        insight: insightFor(aspects.forYou),
        transitHit: forYouHit,
        timelessText: bullets.forYou.text,
      }),
    },
    together: bullets.together,
  };
}

export interface CompatMatchResult {
  userId: string;
  chartId: string;
  displayName: string;
  score: number;
  facets: Array<{ id: string; name: string; weight: number; score: number; explanation: string }>;
  rationale: string;
  explanationProfile: CompatibilityExplanationProfilePublic;
  lastUpdated: string;
  compatibilityFieldHash?: string;
  bio?: string;
  avatarUrl?: string;
  lookingFor?: string;
  /** @internal Bullet framing only; never sent to clients. */
  _transitMeta?: CompatMatchTransitMeta;
  /** @internal Aspect picks for transit bullet framing; never sent to clients. */
  _bulletAspects?: {
    forThem?: DirectedSnapshotAspect;
    forYou?: DirectedSnapshotAspect;
    together?: DirectedSnapshotAspect;
  };
}

export type GetCompatMatchesOptions = {
  /** Default true unless ENABLE_TRANSIT_DISCOVERY=0 or includeTransits: false. */
  includeTransits?: boolean;
  transitInput?: DiscoveryTransitInput;
};

function clampScore(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function facetsFromScoring(scoring: RelationalFieldScoreContract): CompatMatchResult['facets'] {
  return [
    {
      id: 'cohesion',
      name: 'Cohesion',
      weight: 1,
      score: clampScore(scoring.derived_indices.cohesion_index),
      explanation: compatibilityFacetExplanation('cohesion', scoring),
    },
    {
      id: 'tension',
      name: 'Tension',
      weight: 1,
      score: clampScore(scoring.derived_indices.tension_index),
      explanation: compatibilityFacetExplanation('tension', scoring),
    },
    {
      id: 'transformation',
      name: 'Transformation',
      weight: 1,
      score: clampScore(scoring.derived_indices.transformation_index),
      explanation: compatibilityFacetExplanation('transformation', scoring),
    },
    {
      id: 'stability',
      name: 'Stability',
      weight: 1,
      score: clampScore(scoring.derived_indices.stability_index),
      explanation: compatibilityFacetExplanation('stability', scoring),
    },
  ];
}

async function computeMatchSynastry(chartIdA: string, chartIdB: string): Promise<DirectedSnapshotAspect[]> {
  const [snapA, snapB] = await Promise.all([getChartSnapshotCached(chartIdA), getChartSnapshotCached(chartIdB)]);
  return computeSynastryAspects({
    snapshotsOrdered: [snapA, snapB],
    mode: 'pair',
  });
}

/**
 * Pick three distinct aspects for Discovery bullets.
 * Phase 2: chart-pair seeded top-N selection; optional batch dedupe soft-penalty.
 */
export function pickThreeDistinctAspects(
  aToBList: ReadonlyArray<DirectedSnapshotAspect>,
  bToAList: ReadonlyArray<DirectedSnapshotAspect>,
  chartIdA: string,
  chartIdB: string,
  batchUsedKeys?: Set<string>
): {
  forThem: DirectedSnapshotAspect | undefined;
  forYou: DirectedSnapshotAspect | undefined;
  together: DirectedSnapshotAspect | undefined;
} {
  const usedKeys = new Set<string>();

  const pickFromTopN = (
    list: ReadonlyArray<DirectedSnapshotAspect>,
    startIdx: number,
    seed: string,
    topN = 7
  ): DirectedSnapshotAspect | undefined => {
    const candidates: DirectedSnapshotAspect[] = [];
    for (let i = startIdx; i < list.length && candidates.length < topN; i++) {
      const aspect = list[i];
      if (!aspect) continue;
      const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
      if (usedKeys.has(key)) continue;
      if (batchUsedKeys?.has(key)) {
        const hasFreshLater = list.slice(i + 1).some((later) => {
          const laterKey = buildAspectKey(later.bodyA, later.bodyB, later.type);
          return !usedKeys.has(laterKey) && !batchUsedKeys.has(laterKey);
        });
        if (hasFreshLater) continue;
      }
      candidates.push(aspect);
    }
    if (candidates.length === 0) return undefined;
    const idx = hash32(seed) % candidates.length;
    const selected = candidates[idx]!;
    usedKeys.add(buildAspectKey(selected.bodyA, selected.bodyB, selected.type));
    return selected;
  };

  const baseSeed = `${chartIdA}:${chartIdB}`;
  const forThem = pickFromTopN(aToBList, 0, `${baseSeed}:forThem`);
  const forYou = pickFromTopN(bToAList, 0, `${baseSeed}:forYou`);
  let together = pickFromTopN(aToBList, 0, `${baseSeed}:together`);
  if (!together || usedKeys.size < 3) {
    together = pickFromTopN(bToAList, 0, `${baseSeed}:together:fallback`) ?? together;
  }

  return { forThem, forYou, together };
}

const PERSONAL_PLANETS_FOR_BULLETS = new Set(['sun', 'moon', 'mercury', 'venus', 'mars']);

const RELATIONAL_PRIORITY_FOR_BULLETS: ReadonlyArray<readonly [string, string]> = [
  ['moon', 'moon'],
  ['moon', 'venus'],
  ['venus', 'venus'],
  ['moon', 'mercury'],
  ['venus', 'mercury'],
  ['sun', 'moon'],
  ['sun', 'venus'],
  ['mercury', 'mercury'],
  ['mars', 'venus'],
  ['sun', 'mercury'],
  ['sun', 'sun'],
];

function titleBodyForBullet(name: string): string {
  const s = String(name || '').toLowerCase();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getRelationalPriorityIndex(bodyA: string, bodyB: string): number {
  const a = String(bodyA).toLowerCase();
  const b = String(bodyB).toLowerCase();
  const idx = RELATIONAL_PRIORITY_FOR_BULLETS.findIndex(
    ([p1, p2]) => (p1 === a && p2 === b) || (p1 === b && p2 === a)
  );
  return idx === -1 ? 999 : idx;
}

function relationalScoreForAspect(aspect: DirectedSnapshotAspect): number {
  const priorityIndex = getRelationalPriorityIndex(aspect.bodyA, aspect.bodyB);
  const priorityWeight = priorityIndex >= 999 ? 0 : 1 - priorityIndex / RELATIONAL_PRIORITY_FOR_BULLETS.length;
  return priorityWeight * 0.6 + (aspect.exactness ?? 0) * 0.4;
}

function sortAspectsByRelationalPriority(x: DirectedSnapshotAspect, y: DirectedSnapshotAspect): number {
  return relationalScoreForAspect(y) - relationalScoreForAspect(x);
}

async function preparePersonalSynastryLists(
  chartIdA: string,
  chartIdB: string
): Promise<{
  aToBWithCoverage: DirectedSnapshotAspect[];
  bToAWithCoverage: DirectedSnapshotAspect[];
}> {
  const aspects = await computeMatchSynastry(chartIdA, chartIdB);
  const usable = aspects.filter((a) => !isAspectLibraryKillListed(buildAspectKey(a.bodyA, a.bodyB, a.type)));
  const isPersonalBody = (b: string) => PERSONAL_PLANETS_FOR_BULLETS.has(String(b).toLowerCase());

  const aToBFull = usable.filter((a) => a.sourceSlotIndex === 0 && a.targetSlotIndex === 1);
  const bToAFull = usable.filter((a) => a.sourceSlotIndex === 1 && a.targetSlotIndex === 0);

  let aToB = usable
    .filter((a) => isPersonalBody(a.bodyA) && isPersonalBody(a.bodyB))
    .filter((a) => a.sourceSlotIndex === 0 && a.targetSlotIndex === 1);
  let bToA = usable
    .filter((a) => isPersonalBody(a.bodyA) && isPersonalBody(a.bodyB))
    .filter((a) => a.sourceSlotIndex === 1 && a.targetSlotIndex === 0);
  aToB.sort(sortAspectsByRelationalPriority);
  bToA.sort(sortAspectsByRelationalPriority);

  const filterWithLibraryCoverage = (aspectList: DirectedSnapshotAspect[]): DirectedSnapshotAspect[] =>
    aspectList.filter((aspect) => getAspectInsight(buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type)) != null);

  let aToBWithCoverage = filterWithLibraryCoverage(aToB);
  let bToAWithCoverage = filterWithLibraryCoverage(bToA);

  if (aToBWithCoverage.length === 0 && aToBFull.length > 0) {
    aToB = aToBFull.filter((a) => isPersonalBody(a.bodyA) && isPersonalBody(a.bodyB));
    aToB.sort(sortAspectsByRelationalPriority);
    aToBWithCoverage = filterWithLibraryCoverage(aToB);
  }
  if (bToAWithCoverage.length === 0 && bToAFull.length > 0) {
    bToA = bToAFull.filter((a) => isPersonalBody(a.bodyA) && isPersonalBody(a.bodyB));
    bToA.sort(sortAspectsByRelationalPriority);
    bToAWithCoverage = filterWithLibraryCoverage(bToA);
  }

  return { aToBWithCoverage, bToAWithCoverage };
}

function formatAspectBullet(
  aspect: DirectedSnapshotAspect | undefined,
  intent: 'friend' | 'partner',
  options?: { maxTextLength?: number }
): { anchor: string; text: string } {
  const maxTextLength = options?.maxTextLength ?? 280;
  if (!aspect) {
    return { anchor: '', text: 'Astrological connection details unavailable.' };
  }

  const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
  const insight = getAspectInsight(key);
  const formatVariant =
    (aspect.bodyA.charCodeAt(0) + aspect.bodyB.charCodeAt(0) + aspect.type.length) % 4;
  let objectLine: string;
  switch (formatVariant) {
    case 0:
      objectLine = `Your ${titleBodyForBullet(aspect.bodyA)} meets their ${titleBodyForBullet(aspect.bodyB)} at ${aspect.type}`;
      break;
    case 1:
      objectLine = `Your ${titleBodyForBullet(aspect.bodyA)} and their ${titleBodyForBullet(aspect.bodyB)} are ${aspect.type}`;
      break;
    case 2:
      objectLine = `${titleBodyForBullet(aspect.bodyA)}-${titleBodyForBullet(aspect.bodyB)} ${aspect.type}`;
      break;
    case 3:
      objectLine = `Your ${titleBodyForBullet(aspect.bodyA)} ${aspect.type} their ${titleBodyForBullet(aspect.bodyB)}`;
      break;
    default:
      objectLine = `Your ${titleBodyForBullet(aspect.bodyA)} meets their ${titleBodyForBullet(aspect.bodyB)} at ${aspect.type}`;
  }

  if (!insight) {
    return { anchor: '', text: `${objectLine}—Astrological insight for this aspect is being prepared.` };
  }

  const prose =
    (intent === 'partner' ? insight.romantic_synastry : insight.friendship_synastry) ??
    insight.behavioral_synastry ??
    insight.core_synastry ??
    insight.core;

  if (!prose) {
    return { anchor: '', text: `${objectLine}—Insight text unavailable.` };
  }

  const sentences = prose.split(/\.\s+/).filter((s) => s.trim().length > 0);
  const firstSentence = sentences[0] || '';
  const isTechnicalLabel =
    /are (sextile|trine|square|opposition|conjunct)/i.test(firstSentence) ||
    /Your \w+ and their \w+ are (sextile|trine|square|opposition|conjunct)/i.test(firstSentence) ||
    /sixty degrees apart|ninety degrees apart|one hundred twenty degrees/i.test(firstSentence) ||
    /in the same element(al family)?/i.test(firstSentence);

  let startIdx = 0;
  if (isTechnicalLabel && sentences.length > 1) {
    const rotation =
      aspect.type === 'square' || aspect.type === 'opposition'
        ? 1
        : 0;
    startIdx = 1 + (rotation % Math.max(1, sentences.length - 3));
  } else {
    const rotation = aspect.type === 'square' || aspect.type === 'opposition' ? 1 : 0;
    startIdx = rotation % Math.max(1, sentences.length - 2);
  }

  const endIdx = Math.min(startIdx + 3, sentences.length);
  let selectedText = sentences.slice(startIdx, endIdx).join('. ');
  if (!selectedText.endsWith('.')) selectedText += '.';

  if (selectedText.length > maxTextLength) {
    selectedText = `${selectedText.substring(0, maxTextLength - 3)}...`;
  }

  return { anchor: '', text: `${objectLine}—${selectedText}` };
}

export type ExtendedCompatBullet = {
  label: string;
  text: string;
  key: string;
};

/**
 * Extended compatibility bullets for profile view (8–10 aspects).
 * Phase 6C-1: reuses Discovery selection quality; shows more depth on profile.
 */
export async function generateExtendedCompatibility(
  chartIdA: string,
  chartIdB: string,
  intent: 'friend' | 'partner',
  count = 10
): Promise<ExtendedCompatBullet[]> {
  const { aToBWithCoverage, bToAWithCoverage } = await preparePersonalSynastryLists(chartIdA, chartIdB);
  const discovery = pickThreeDistinctAspects(aToBWithCoverage, bToAWithCoverage, chartIdA, chartIdB);

  const discoveryLabels = [
    "Why you're good for them",
    "Why they're good for you",
    "Why you're good together",
  ] as const;
  const discoveryAspects = [discovery.forThem, discovery.forYou, discovery.together];

  const results: ExtendedCompatBullet[] = [];
  const usedKeys = new Set<string>();

  for (let i = 0; i < discoveryAspects.length; i++) {
    const aspect = discoveryAspects[i];
    if (!aspect) continue;
    const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    const bullet = formatAspectBullet(aspect, intent, { maxTextLength: 1200 });
    results.push({
      label: discoveryLabels[i] ?? 'Connection',
      text: bullet.text,
      key,
    });
  }

  let aIdx = 0;
  let bIdx = 0;
  while (results.length < count) {
    const preferAToB = results.length % 2 === 0;
    const list = preferAToB ? aToBWithCoverage : bToAWithCoverage;
    let idx = preferAToB ? aIdx : bIdx;
    let picked: DirectedSnapshotAspect | undefined;

    while (idx < list.length) {
      const candidate = list[idx]!;
      const key = buildAspectKey(candidate.bodyA, candidate.bodyB, candidate.type);
      idx++;
      if (usedKeys.has(key)) continue;
      picked = candidate;
      if (preferAToB) aIdx = idx;
      else bIdx = idx;
      break;
    }

    if (!picked) {
      const otherList = preferAToB ? bToAWithCoverage : aToBWithCoverage;
      let otherIdx = preferAToB ? bIdx : aIdx;
      while (otherIdx < otherList.length) {
        const candidate = otherList[otherIdx]!;
        const key = buildAspectKey(candidate.bodyA, candidate.bodyB, candidate.type);
        otherIdx++;
        if (usedKeys.has(key)) continue;
        picked = candidate;
        if (preferAToB) bIdx = otherIdx;
        else aIdx = otherIdx;
        break;
      }
    }

    if (!picked) break;

    const key = buildAspectKey(picked.bodyA, picked.bodyB, picked.type);
    usedKeys.add(key);
    const fromSeeker = picked.sourceSlotIndex === 0 && picked.targetSlotIndex === 1;
    const label = fromSeeker
      ? `Your ${titleBodyForBullet(picked.bodyA)} and their ${titleBodyForBullet(picked.bodyB)}`
      : `Their ${titleBodyForBullet(picked.bodyA)} and your ${titleBodyForBullet(picked.bodyB)}`;
    const bullet = formatAspectBullet(picked, intent, { maxTextLength: 1200 });
    results.push({ label, text: bullet.text, key });
  }

  return results;
}

async function generateCompatibilityBullets(
  chartIdA: string,
  chartIdB: string,
  intent: 'friend' | 'partner',
  batchUsedKeys?: Set<string>
): Promise<{
  bullets: {
    forThem: { anchor: string; text: string };
    forYou: { anchor: string; text: string };
    together: { anchor: string; text: string };
  };
  aspects: {
    forThem?: DirectedSnapshotAspect;
    forYou?: DirectedSnapshotAspect;
    together?: DirectedSnapshotAspect;
  };
}> {
  const aspects = await computeMatchSynastry(chartIdA, chartIdB);
  const usable = aspects.filter((a) => !isAspectLibraryKillListed(buildAspectKey(a.bodyA, a.bodyB, a.type)));

  const aToBFull = usable.filter((a) => a.sourceSlotIndex === 0 && a.targetSlotIndex === 1);
  const bToAFull = usable.filter((a) => a.sourceSlotIndex === 1 && a.targetSlotIndex === 0);

  const PERSONAL_PLANETS = new Set(['sun', 'moon', 'mercury', 'venus', 'mars']);
  const isPersonalBody = (b: string) => PERSONAL_PLANETS.has(String(b).toLowerCase());

  const RELATIONAL_PRIORITY: ReadonlyArray<readonly [string, string]> = [
    ['moon', 'moon'],
    ['moon', 'venus'],
    ['venus', 'venus'],
    ['moon', 'mercury'],
    ['venus', 'mercury'],
    ['sun', 'moon'],
    ['sun', 'venus'],
    ['mercury', 'mercury'],
    ['mars', 'venus'],
    ['sun', 'mercury'],
    ['sun', 'sun'],
  ];

  const getPriorityIndex = (bodyA: string, bodyB: string): number => {
    const a = String(bodyA).toLowerCase();
    const b = String(bodyB).toLowerCase();
    const idx = RELATIONAL_PRIORITY.findIndex(
      ([p1, p2]) => (p1 === a && p2 === b) || (p1 === b && p2 === a)
    );
    return idx === -1 ? 999 : idx;
  };

  const relationalScore = (aspect: DirectedSnapshotAspect): number => {
    const priorityIndex = getPriorityIndex(aspect.bodyA, aspect.bodyB);
    const priorityWeight = priorityIndex >= 999 ? 0 : 1 - priorityIndex / RELATIONAL_PRIORITY.length;
    const exactnessWeight = aspect.exactness ?? 0;
    return priorityWeight * 0.6 + exactnessWeight * 0.4;
  };

  const sortByRelationalPriority = (x: DirectedSnapshotAspect, y: DirectedSnapshotAspect) => {
    return relationalScore(y) - relationalScore(x);
  };

  const filterWithLibraryCoverage = (aspectList: DirectedSnapshotAspect[]): DirectedSnapshotAspect[] =>
    aspectList.filter((aspect) => {
      const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
      return getAspectInsight(key) != null;
    });

  const personalOnly = usable.filter((a) => isPersonalBody(a.bodyA) && isPersonalBody(a.bodyB));
  if (process.env.MATCHES_BULLET_DEBUG === '1') {
    console.log('[BULLET_DEBUG] personal planet aspects (usable ∩ personal):', personalOnly.length);
    console.log(
      '[BULLET_DEBUG] first 3 personal aspects:',
      JSON.stringify(
        personalOnly.slice(0, 3).map((a) => ({
          bodyA: a.bodyA,
          bodyB: a.bodyB,
          type: a.type,
          exactness: a.exactness,
          dir: `${a.sourceSlotIndex}→${a.targetSlotIndex}`,
        })),
        null,
        2
      )
    );
  }
  let aToB = personalOnly.filter((a) => a.sourceSlotIndex === 0 && a.targetSlotIndex === 1);
  let bToA = personalOnly.filter((a) => a.sourceSlotIndex === 1 && a.targetSlotIndex === 0);
  aToB.sort(sortByRelationalPriority);
  bToA.sort(sortByRelationalPriority);

  let aToBWithCoverage = filterWithLibraryCoverage(aToB);
  let bToAWithCoverage = filterWithLibraryCoverage(bToA);

  if (aToBWithCoverage.length === 0 && aToBFull.length > 0) {
    aToB = [...aToBFull];
    aToB.sort(sortByRelationalPriority);
    aToBWithCoverage = filterWithLibraryCoverage(aToB);
  }
  if (bToAWithCoverage.length === 0 && bToAFull.length > 0) {
    bToA = [...bToAFull];
    bToA.sort(sortByRelationalPriority);
    bToAWithCoverage = filterWithLibraryCoverage(bToA);
  }

  if (process.env.MATCHES_BULLET_DEBUG === '1') {
    console.log(`[matches] Synastry aspects for ${chartIdA} + ${chartIdB}:`);
    console.log(`  Total aspects: ${aspects.length}, Usable after kill-list: ${usable.length}`);
    console.log(`  A→B with library coverage: ${aToBWithCoverage.length} of ${aToB.length}`);
    console.log(`  B→A with library coverage: ${bToAWithCoverage.length} of ${bToA.length}`);
    console.log(
      `  Top A→B:`,
      aToBWithCoverage.slice(0, 3).map((a) => `${a.bodyA} ${a.type} ${a.bodyB} (${(a.exactness ?? 0).toFixed(2)})`)
    );
    console.log(
      `  Top B→A:`,
      bToAWithCoverage.slice(0, 3).map((a) => `${a.bodyA} ${a.type} ${a.bodyB} (${(a.exactness ?? 0).toFixed(2)})`)
    );
    const skippedAToB = aToB.filter((a) => !aToBWithCoverage.includes(a)).slice(0, 3);
    const skippedBToA = bToA.filter((a) => !bToAWithCoverage.includes(a)).slice(0, 3);
    if (skippedAToB.length > 0) {
      console.log(
        `  Skipped A→B (no library):`,
        skippedAToB.map((a) => buildAspectKey(a.bodyA, a.bodyB, a.type))
      );
    }
    if (skippedBToA.length > 0) {
      console.log(
        `  Skipped B→A (no library):`,
        skippedBToA.map((a) => buildAspectKey(a.bodyA, a.bodyB, a.type))
      );
    }
  }

  const titleBody = (name: string) => {
    const s = String(name || '').toLowerCase();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const generateBullet = (aspect: DirectedSnapshotAspect | undefined): { anchor: string; text: string } => {
    if (!aspect) {
      return { anchor: '', text: 'Astrological connection details unavailable.' };
    }

    const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
    const insight = getAspectInsight(key);
    const formatVariant =
      (aspect.bodyA.charCodeAt(0) + aspect.bodyB.charCodeAt(0) + aspect.type.length) % 4;
    let objectLine: string;
    switch (formatVariant) {
      case 0:
        objectLine = `Your ${titleBody(aspect.bodyA)} meets their ${titleBody(aspect.bodyB)} at ${aspect.type}`;
        break;
      case 1:
        objectLine = `Your ${titleBody(aspect.bodyA)} and their ${titleBody(aspect.bodyB)} are ${aspect.type}`;
        break;
      case 2:
        objectLine = `${titleBody(aspect.bodyA)}-${titleBody(aspect.bodyB)} ${aspect.type}`;
        break;
      case 3:
        objectLine = `Your ${titleBody(aspect.bodyA)} ${aspect.type} their ${titleBody(aspect.bodyB)}`;
        break;
      default:
        objectLine = `Your ${titleBody(aspect.bodyA)} meets their ${titleBody(aspect.bodyB)} at ${aspect.type}`;
    }

    if (!insight) {
      console.warn(`[matches] Unexpected: aspect ${key} passed filter but has no library entry`);
      return { anchor: '', text: `${objectLine}—Astrological insight for this aspect is being prepared.` };
    }

    // Phase 4A: Prefer variant fields (romantic/friendship) which have Co-Star voice from May 14 rewrite.
    // Phase 4B will rewrite behavioral/core to match, making them preferred again for depth.
    const prose =
      (intent === 'partner' ? insight.romantic_synastry : insight.friendship_synastry) ??
      insight.behavioral_synastry ??
      insight.core_synastry ??
      insight.core;

    if (!prose) {
      return { anchor: '', text: `${objectLine}—Insight text unavailable.` };
    }

    const sentences = prose.split(/\.\s+/).filter((s) => s.trim().length > 0);
    const firstSentence = sentences[0] || '';
    const isTechnicalLabel =
      /are (sextile|trine|square|opposition|conjunct)/i.test(firstSentence) ||
      /Your \w+ and their \w+ are (sextile|trine|square|opposition|conjunct)/i.test(firstSentence) ||
      /sixty degrees apart|ninety degrees apart|one hundred twenty degrees/i.test(firstSentence) ||
      /in the same element(al family)?/i.test(firstSentence);

    let startIdx = 0;
    if (isTechnicalLabel && sentences.length > 1) {
      const rotation =
        aspect.type === 'conjunction'
          ? 0
          : aspect.type === 'sextile'
            ? 0
            : aspect.type === 'square'
              ? 1
              : aspect.type === 'trine'
                ? 0
                : aspect.type === 'opposition'
                  ? 1
                  : 0;
      startIdx = 1 + (rotation % Math.max(1, sentences.length - 3));
    } else {
      const rotation = aspect.type === 'square' ? 1 : aspect.type === 'opposition' ? 1 : 0;
      startIdx = rotation % Math.max(1, sentences.length - 2);
    }

    const endIdx = Math.min(startIdx + 3, sentences.length);
    let selectedText = sentences.slice(startIdx, endIdx).join('. ');
    if (!selectedText.endsWith('.')) selectedText += '.';

    if (selectedText.length > 280) {
      selectedText = `${selectedText.substring(0, 277)}...`;
    }

    return { anchor: '', text: `${objectLine}—${selectedText}` };
  };

  const selectedAspects = pickThreeDistinctAspects(
    aToBWithCoverage,
    bToAWithCoverage,
    chartIdA,
    chartIdB,
    batchUsedKeys
  );

  if (batchUsedKeys) {
    for (const aspect of [selectedAspects.forThem, selectedAspects.forYou, selectedAspects.together]) {
      if (aspect) {
        batchUsedKeys.add(buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type));
      }
    }
  }

  const out = {
    forThem: generateBullet(selectedAspects.forThem),
    forYou: generateBullet(selectedAspects.forYou),
    together: generateBullet(selectedAspects.together),
  };
  if (process.env.MATCHES_BULLET_DEBUG === '1') {
    const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n)}…`);
    console.log(
      '[BULLET_DEBUG] generated bullets (anchor + text clip):',
      JSON.stringify(
        {
          forThem: { anchor: out.forThem.anchor, text: clip(out.forThem.text, 50) },
          forYou: { anchor: out.forYou.anchor, text: clip(out.forYou.text, 50) },
          together: { anchor: out.together.anchor, text: clip(out.together.text, 50) },
        },
        null,
        2
      )
    );
  }
  return { bullets: out, aspects: selectedAspects };
}

/** Longitude for a core body from an ephemeris snapshot (lowercase names). */
function lonForBody(snapshot: EphemerisSnapshot, body: string): number | null {
  const key = body.toLowerCase();
  for (const p of snapshot.planets || []) {
    if (!p?.name) continue;
    if (String(p.name).toLowerCase() !== key) continue;
    if (typeof p.lon !== 'number' || !Number.isFinite(p.lon)) return null;
    return p.lon;
  }
  return null;
}

/**
 * Score an aspect type for relationship compatibility (higher = more harmonious).
 */
function scoreAspectType(aspectType: string | null | undefined): number {
  if (!aspectType) return 0;
  const scores: Record<string, number> = {
    trine: 5,
    sextile: 4,
    conjunction: 3,
    opposition: 2,
    square: 1,
  };
  return scores[aspectType] ?? 0;
}

/**
 * Fast Moon/Venus cross-chart screen (geometry only, no full synastry).
 * `mode` nudges weights: friend → Moon emphasis; lover → Venus / cross emphasis.
 */
function scoreMoonVenusCompatibility(
  userSnapshot: EphemerisSnapshot,
  candidateSnapshot: EphemerisSnapshot,
  mode: RelationalIntent
): number {
  const userMoon = lonForBody(userSnapshot, 'moon');
  const userVenus = lonForBody(userSnapshot, 'venus');
  const candMoon = lonForBody(candidateSnapshot, 'moon');
  const candVenus = lonForBody(candidateSnapshot, 'venus');

  if (userMoon == null || userVenus == null || candMoon == null || candVenus == null) {
    return 0;
  }

  let total = 0;

  const moonMoon = findBestDirectedCrossAspect(userMoon, candMoon);
  if (moonMoon) {
    let w = scoreAspectType(moonMoon.type) * 1.2;
    if (mode === 'friend') w *= 1.1;
    total += w;
  }

  const venusVenus = findBestDirectedCrossAspect(userVenus, candVenus);
  if (venusVenus) {
    let w = scoreAspectType(venusVenus.type);
    if (mode === 'lover') w *= 1.15;
    total += w;
  }

  const moonVenus = findBestDirectedCrossAspect(userMoon, candVenus);
  if (moonVenus) {
    let w = scoreAspectType(moonVenus.type) * 1.1;
    if (mode === 'lover') w *= 1.05;
    total += w;
  }

  const venusMoon = findBestDirectedCrossAspect(userVenus, candMoon);
  if (venusMoon) {
    let w = scoreAspectType(venusMoon.type) * 1.1;
    if (mode === 'lover') w *= 1.05;
    total += w;
  }

  return total;
}

const MAX_SYNASTRY_COMPUTATIONS = 10;
async function directoryRowsForMatches(chartId: string): Promise<DirectoryEligibleUser[]> {
  await storage.ensureDefaultProfileChart();
  let rows = await storage.listDirectoryEligibleUsers();
  if (rows.length === 0) {
    const seeded = await storage.ensureMatchCandidateCharts();
    rows = seeded.map((c) => ({
      userId: c.userId,
      displayName: c.displayName,
      chartId: c.chartId,
      discoverableAs: c.discoverableAs ?? 'both',
      ...(c.bio ? { bio: c.bio } : {}),
      ...(c.avatarUrl ? { avatarUrl: c.avatarUrl } : {}),
      ...(c.lookingFor ? { lookingFor: c.lookingFor } : {}),
    }));
  }
  return rows.filter((r) => r.chartId !== chartId);
}

function transitDiscoveryEnabled(options?: GetCompatMatchesOptions): boolean {
  if (options?.includeTransits === false) return false;
  if (process.env.ENABLE_TRANSIT_DISCOVERY === '0') return false;
  return true;
}

/**
 * Get compatibility matches for a chart.
 * Ranking only: the canonical field + unified scoring contract remain the single compute path.
 * When transit discovery is enabled, final order uses 60% base + 40% daily transit activation (not exposed in API).
 */
export async function getCompatMatches(
  chartId: string,
  mode: RelationalIntent,
  limit: number,
  options?: GetCompatMatchesOptions
): Promise<CompatMatchResult[]> {
  const chart = await getChartById(chartId);
  if (!chart) throw new Error(`Chart not found: ${chartId}`);

  const requestingUserId = chart.ownerId ?? (await storage.getUserIdForPrimaryChart(chartId)) ?? '';
  const visibilityType = mode === 'lover' ? 'partners' : 'friends';

  const allCandidates = await directoryRowsForMatches(chartId);
  const candidates = allCandidates.filter((candidate) => {
    if (requestingUserId && candidate.userId === requestingUserId) return false;
    const discoverableAs = candidate.discoverableAs || 'none';
    if (discoverableAs === 'none') return false;
    if (discoverableAs === 'both') return true;
    return discoverableAs === visibilityType;
  });

  if (candidates.length === 0) {
    return [];
  }

  console.log(`[matches] Pre-filtering ${candidates.length} candidates by Moon/Venus compatibility`);

  let userSnapshot: EphemerisSnapshot;
  try {
    userSnapshot = await getChartSnapshotCached(chartId);
  } catch (err) {
    console.error('[matches] Failed to load user snapshot for pre-filtering:', err);
    throw new Error('Unable to load your chart data');
  }

  const scoredCandidates = await Promise.all(
    candidates.map(async (candidate) => {
      let compatScore = 0;
      try {
        const candidateSnapshot = await getChartSnapshotCached(candidate.chartId);
        compatScore = scoreMoonVenusCompatibility(userSnapshot, candidateSnapshot, mode);
      } catch (err) {
        console.warn(`[matches] Failed to score ${candidate.chartId}:`, err);
        compatScore = 0;
      }
      return { ...candidate, moonVenusScore: compatScore };
    })
  );

  scoredCandidates.sort((a, b) => {
    if (b.moonVenusScore !== a.moonVenusScore) return b.moonVenusScore - a.moonVenusScore;
    return a.chartId.localeCompare(b.chartId);
  });

  const topCandidates = scoredCandidates.slice(0, MAX_SYNASTRY_COMPUTATIONS);

  console.log(
    `[matches] Top ${topCandidates.length} by Moon/Venus score:`,
    topCandidates.map((c) => `${c.displayName || c.userId} (${c.moonVenusScore.toFixed(1)})`).join(', ')
  );

  const results: CompatMatchResult[] = [];
  const intentForBullets = mode === 'lover' ? 'partner' : 'friend';
  const batchUsedKeys = new Set<string>();

  for (let i = 0; i < topCandidates.length; i++) {
    const cand = topCandidates[i]!;
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    try {
      const computed = await computeCompatibilitySystem({
        chartIds: [chartId, cand.chartId],
        relationshipBindingId: null,
      });
      const score = canonicalIntentRank(computed.scoring, mode);
      const { bullets, aspects: bulletAspects } = await generateCompatibilityBullets(
        chartId,
        cand.chartId,
        intentForBullets,
        batchUsedKeys
      );
      if (process.env.MATCHES_BULLET_DEBUG === '1') {
        const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n)}...`);
        console.log(
          `[matches] Bullets for ${cand.displayName ?? cand.userId} (seeker ${chartId} vs candidate ${cand.chartId}, bulletsIntent=${intentForBullets}):`
        );
        console.log(`  forThem (A→B): ${clip(bullets.forThem.text, 60)}`);
        console.log(`  forYou (B→A): ${clip(bullets.forYou.text, 60)}`);
        console.log(`  together: ${clip(bullets.together.text, 60)}`);
      }
      const explanationProfile: CompatibilityExplanationProfilePublic = {
        intent: mode,
        intentFitSummary: '',
        primarySupports: [bullets.forYou.text],
        secondarySupports: [bullets.forThem.text],
        tensionsOrLimits: [bullets.together.text],
        synastryBullets: {
          forYou: bullets.forYou,
          forThem: bullets.forThem,
          together: bullets.together,
        },
      };
      results.push({
        userId: cand.userId,
        chartId: cand.chartId,
        displayName: cand.displayName || 'User',
        score,
        facets: facetsFromScoring(computed.scoring),
        rationale: `${Math.round(score * 100)}% match`,
        explanationProfile,
        lastUpdated: new Date().toISOString(),
        compatibilityFieldHash: computed.field.object_identity_hash,
        bio: cand.bio,
        avatarUrl: cand.avatarUrl,
        lookingFor: cand.lookingFor,
        _bulletAspects: bulletAspects,
      });
      console.log(`[matches] Computed synastry for ${cand.displayName || cand.userId}: ${(score * 100).toFixed(0)}%`);
    } catch (err) {
      console.error(`[matches] Failed to compute synastry for ${cand.chartId}:`, err);
    }
  }

  let ranked = results;

  if (transitDiscoveryEnabled(options) && ranked.length > 0) {
    let effectiveTransitInput = options?.transitInput ?? null;
    if (!effectiveTransitInput) {
      effectiveTransitInput = await resolveSeekerTransitInput(chartId);
    }

    if (effectiveTransitInput) {
      try {
        const cachedTransit = await warmDailyTransitCache(effectiveTransitInput);
        const withDaily = await Promise.all(
          ranked.map(async (match) => {
            const baseScore = match.score;
            const transitAmp = await computeTransitAmplification({
              seekerChartId: chartId,
              candidateChartId: match.chartId,
              transitInput: effectiveTransitInput!,
              transitSnapshot: cachedTransit,
            });
            const dailyRankScore = blendDiscoveryDailyScore(baseScore, transitAmp.score);
            return {
              ...match,
              dailyRankScore,
              _transitMeta: {
                topHits: transitAmp.topHits,
              },
            };
          })
        );
        withDaily.sort((a, b) => {
          const da = (a as { dailyRankScore: number }).dailyRankScore;
          const db = (b as { dailyRankScore: number }).dailyRankScore;
          if (db !== da) return db - da;
          return a.chartId.localeCompare(b.chartId);
        });
        ranked = withDaily.map((row) => {
          const { dailyRankScore: _dailyRankScore, ...rest } = row as CompatMatchResult & {
            dailyRankScore: number;
          };
          const match = rest as CompatMatchResult;
          if (match._transitMeta?.topHits?.length && match.explanationProfile.synastryBullets) {
            const framed = applyTransitFeedToSynastryBullets(
              match.explanationProfile.synastryBullets,
              match._bulletAspects ?? {},
              match._transitMeta
            );
            match.explanationProfile = {
              ...match.explanationProfile,
              primarySupports: [framed.forYou.text],
              secondarySupports: [framed.forThem.text],
              tensionsOrLimits: [framed.together.text],
              synastryBullets: framed,
            };
          }
          return match;
        });
      } catch (err) {
        console.warn('[matches] Transit daily ranking failed; using natal order', err);
        ranked.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.chartId.localeCompare(b.chartId);
        });
      }
    } else {
      console.warn('[matches] No seeker transit input; natal-only ranking');
      ranked.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.chartId.localeCompare(b.chartId);
      });
    }
  } else {
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chartId.localeCompare(b.chartId);
    });
  }

  return ranked.slice(0, limit);
}

/** Public API shape: prose only, no ranking math exposed. */
export function toPublicCompatMatch(match: CompatMatchResult): Omit<
  CompatMatchResult,
  'score' | 'rationale' | 'facets' | '_transitMeta' | '_bulletAspects'
> {
  const {
    score: _s,
    rationale: _r,
    facets: _f,
    _transitMeta: _t,
    _bulletAspects: _a,
    ...publicFields
  } = match;
  return publicFields;
}
