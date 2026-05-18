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

/**
 * Pick three distinct aspects for Discovery bullets, avoiding duplication.
 * Prefers high-priority aspects but ensures each bullet shows a different planet pair + aspect type.
 */
function pickThreeDistinctAspects(
  aToBList: DirectedSnapshotAspect[],
  bToAList: DirectedSnapshotAspect[]
): {
  forThem: DirectedSnapshotAspect | undefined;
  forYou: DirectedSnapshotAspect | undefined;
  together: DirectedSnapshotAspect | undefined;
} {
  const usedKeys = new Set<string>();

  const pickUnique = (list: DirectedSnapshotAspect[], startIdx: number = 0): DirectedSnapshotAspect | undefined => {
    if (!list.length) return undefined;
    for (let i = startIdx; i < list.length; i++) {
      const aspect = list[i]!;
      const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
      if (!usedKeys.has(key)) {
        usedKeys.add(key);
        return aspect;
      }
    }
    return list[0];
  };

  const forThem = pickUnique(aToBList, 0);
  const forYou = pickUnique(bToAList, 0);

  let together = pickUnique(aToBList, 1);
  if (!together || usedKeys.size < 3) {
    together = pickUnique(bToAList, 1) ?? together;
  }
  if (!together) {
    together = pickUnique(aToBList, 0) ?? pickUnique(bToAList, 0);
  }

  return { forThem, forYou, together };
}

async function generateCompatibilityBullets(
  chartIdA: string,
  chartIdB: string,
  intent: 'friend' | 'partner'
): Promise<{
  forThem: { anchor: string; text: string };
  forYou: { anchor: string; text: string };
  together: { anchor: string; text: string };
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

  const selectedAspects = pickThreeDistinctAspects(aToBWithCoverage, bToAWithCoverage);

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
  return out;
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
