/**
 * Compatibility matches: ranking adapter over the canonical compatibility field.
 * No independent scoring logic lives here.
 */

import { getChartById, getChartSnapshotCached } from './chart-store';
import * as storage from './storage';
import type { DirectoryEligibleUser } from './storage';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../projection/insight-library/aspect-library-kill-list';
import type { DirectedSnapshotAspect } from '../synastry/synastry-types';
import type { EphemerisSnapshot } from '../contracts';
import { compatibilityFacetExplanation } from '../projection/insight/map-insight-unit-v1';
import { computeCompatibilitySystem } from '../compatibility/service';
import type { RelationalFieldScoreContract } from '../compatibility/contracts';
import type { RelationalIntent } from '../compatibility/relational-intent';
import { canonicalIntentRank } from '../compatibility/intent-rank';
import type { CompatibilityExplanationProfilePublic } from '../compatibility/discovery-explanation';
import { findBestDirectedCrossAspect } from '../synastry/cross-chart-best-aspect';

/** @deprecated Use RelationalIntent from ../compatibility/relational-intent */
export type CompatMatchMode = RelationalIntent;

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
}

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

async function generateCompatibilityBullets(
  chartIdA: string,
  chartIdB: string,
  intent: 'friend' | 'partner'
): Promise<{ forThem: string; forYou: string; together: string }> {
  const aspects = await computeMatchSynastry(chartIdA, chartIdB);
  const usable = aspects.filter((a) => !isAspectLibraryKillListed(buildAspectKey(a.bodyA, a.bodyB, a.type)));

  const aToB = usable.filter((a) => a.sourceSlotIndex === 0 && a.targetSlotIndex === 1);
  const bToA = usable.filter((a) => a.sourceSlotIndex === 1 && a.targetSlotIndex === 0);

  const sortByStrength = (x: DirectedSnapshotAspect, y: DirectedSnapshotAspect) =>
    (y.exactness ?? 0) - (x.exactness ?? 0);
  aToB.sort(sortByStrength);
  bToA.sort(sortByStrength);

  const filterWithLibraryCoverage = (aspectList: DirectedSnapshotAspect[]): DirectedSnapshotAspect[] =>
    aspectList.filter((aspect) => {
      const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
      return getAspectInsight(key) != null;
    });

  const aToBWithCoverage = filterWithLibraryCoverage(aToB);
  const bToAWithCoverage = filterWithLibraryCoverage(bToA);

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

  const generateBullet = (aspect: DirectedSnapshotAspect | undefined): string => {
    if (!aspect) return 'Astrological connection details unavailable.';

    const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
    const insight = getAspectInsight(key);
    if (!insight) {
      console.warn(`[matches] Unexpected: aspect ${key} passed filter but has no library entry`);
      return 'Astrological connection details unavailable.';
    }

    const firstSentenceFrom = (paragraph: string | null | undefined): string | null => {
      if (!paragraph || typeof paragraph !== 'string') return null;
      const raw = paragraph.split('.')[0]?.trim();
      if (!raw) return null;
      return raw.length <= 200 ? `${raw}.` : `${raw.slice(0, 197)}...`;
    };

    const variantText =
      intent === 'partner'
        ? (insight.romantic_synastry ?? insight.romantic ?? null)
        : (insight.friendship_synastry ?? insight.friendship ?? null);

    const fromVariant = firstSentenceFrom(variantText);
    if (fromVariant) return fromVariant;

    const coreText = insight.core_synastry ?? insight.core ?? null;
    const fromCore = firstSentenceFrom(coreText);
    if (fromCore) return fromCore;

    return 'Astrological connection details unavailable.';
  };

  return {
    forThem: generateBullet(aToBWithCoverage[0]),
    forYou: generateBullet(bToAWithCoverage[0]),
    together: generateBullet(aToBWithCoverage[1] ?? bToAWithCoverage[1]),
  };
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

/**
 * Get compatibility matches for a chart.
 * Ranking only: the canonical field + unified scoring contract remain the single compute path.
 */
export async function getCompatMatches(
  chartId: string,
  mode: RelationalIntent,
  limit: number
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
      const bullets = await generateCompatibilityBullets(chartId, cand.chartId, intentForBullets);
      if (process.env.MATCHES_BULLET_DEBUG === '1') {
        const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n)}...`);
        console.log(
          `[matches] Bullets for ${cand.displayName ?? cand.userId} (seeker ${chartId} vs candidate ${cand.chartId}, bulletsIntent=${intentForBullets}):`
        );
        console.log(`  forThem (A→B): ${clip(bullets.forThem, 60)}`);
        console.log(`  forYou (B→A): ${clip(bullets.forYou, 60)}`);
        console.log(`  together: ${clip(bullets.together, 60)}`);
      }
      const explanationProfile: CompatibilityExplanationProfilePublic = {
        intent: mode,
        intentFitSummary: '',
        primarySupports: [bullets.forYou],
        secondarySupports: [bullets.forThem],
        tensionsOrLimits: [bullets.together],
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
      });
      console.log(`[matches] Computed synastry for ${cand.displayName || cand.userId}: ${(score * 100).toFixed(0)}%`);
    } catch (err) {
      console.error(`[matches] Failed to compute synastry for ${cand.chartId}:`, err);
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chartId.localeCompare(b.chartId);
  });
  return results.slice(0, limit);
}
