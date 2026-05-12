/**
 * Compatibility matches: ranking adapter over the canonical compatibility field.
 * No independent scoring logic lives here.
 */

import { getChartById } from './chart-store';
import * as storage from './storage';
import type { DirectoryEligibleUser } from './storage';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../projection/insight-library/aspect-library-kill-list';
import { composeSynastryMepAspectParagraph } from '../projection/insight-library/synastry-aspect-library-render';
import type { DirectedSnapshotAspect } from '../synastry/synastry-types';
import type { EphemerisSnapshot } from '../contracts';
import { compatibilityFacetExplanation } from '../projection/insight/map-insight-unit-v1';
import { computeCompatibilitySystem } from '../compatibility/service';
import type { RelationalFieldScoreContract } from '../compatibility/contracts';
import type { RelationalIntent } from '../compatibility/relational-intent';
import { canonicalIntentRank } from '../compatibility/intent-rank';
import type { CompatibilityExplanationProfile } from '../compatibility/discovery-explanation';
import { buildCompatibilityExplanationProfile } from '../compatibility/discovery-explanation';
import { fetchChartSnapshot } from '../core/architecture-engine';

/** @deprecated Use RelationalIntent from ../compatibility/relational-intent */
export type CompatMatchMode = RelationalIntent;

export interface CompatMatchResult {
  userId: string;
  chartId: string;
  displayName: string;
  score: number;
  facets: Array<{ id: string; name: string; weight: number; score: number; explanation: string }>;
  rationale: string;
  explanationProfile: CompatibilityExplanationProfile;
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

async function loadChartSnapshot(chartId: string): Promise<EphemerisSnapshot> {
  const chart = await getChartById(chartId);
  if (!chart) throw new Error(`Chart not found: ${chartId}`);
  return fetchChartSnapshot({
    date: chart.date,
    time: chart.time,
    lat: chart.lat,
    lon: chart.lon,
    timezone: chart.timezone || 'UTC',
  });
}

async function computeMatchSynastry(chartIdA: string, chartIdB: string): Promise<DirectedSnapshotAspect[]> {
  const [snapA, snapB] = await Promise.all([loadChartSnapshot(chartIdA), loadChartSnapshot(chartIdB)]);
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

  const generateBullet = (aspect: DirectedSnapshotAspect | undefined): string => {
    if (!aspect) return 'Aspect data unavailable for this connection.';
    const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
    const insight = getAspectInsight(key);
    if (!insight) {
      return `${aspect.bodyA} ${aspect.type} ${aspect.bodyB} creates interaction between you.`;
    }
    const variant = intent === 'partner' ? 'romantic' : 'friendship';
    const prose = composeSynastryMepAspectParagraph(insight, variant);
    const raw = prose.split('.')[0]?.trim() || '';
    const firstSentence = raw ? `${raw}.` : 'Aspect data unavailable for this connection.';
    return firstSentence.length > 200 ? `${firstSentence.slice(0, 197)}...` : firstSentence;
  };

  return {
    forThem: generateBullet(aToB[0]),
    forYou: generateBullet(bToA[0]),
    together: generateBullet(aToB[1] ?? bToA[1]),
  };
}

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

  const results: CompatMatchResult[] = [];
  const intentForBullets = mode === 'lover' ? 'partner' : 'friend';

  for (const cand of candidates) {
    const computed = await computeCompatibilitySystem({
      chartIds: [chartId, cand.chartId],
      relationshipBindingId: null,
    });
    const score = canonicalIntentRank(computed.scoring, mode);
    const bullets = await generateCompatibilityBullets(chartId, cand.chartId, intentForBullets);
    const explanationProfile = buildCompatibilityExplanationProfile({
      field: computed.field,
      scoring: computed.scoring,
      classification: computed.classification,
      intent: mode,
    });
    results.push({
      userId: cand.userId,
      chartId: cand.chartId,
      displayName: cand.displayName || 'User',
      score,
      facets: facetsFromScoring(computed.scoring),
      rationale: explanationProfile.intentFitSummary,
      explanationProfile: {
        ...explanationProfile,
        primarySupports: [bullets.forYou],
        secondarySupports: [bullets.forThem],
        tensionsOrLimits: [bullets.together],
      },
      lastUpdated: new Date().toISOString(),
      compatibilityFieldHash: computed.field.object_identity_hash,
      bio: cand.bio,
      avatarUrl: cand.avatarUrl,
      lookingFor: cand.lookingFor,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.chartId.localeCompare(b.chartId);
  });
  return results.slice(0, limit);
}
