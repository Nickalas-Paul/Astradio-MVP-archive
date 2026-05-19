/**
 * Transit amplification for Discovery daily match ranking.
 * Reuses Feed's computeCompatibilitySystem + activation_overlay intensity.
 */

import { getChartById } from '../compat/chart-store';
import { computeCompatibilitySystem } from './service';
import { clamp01 } from './stable';
import type { DiscoveryTransitInput } from './daily-transit-cache';
import { getOrFetchDailyTransitSnapshot } from './daily-transit-cache';
import type { EphemerisSnapshot } from '../contracts';
import type { CrossAspectHitV1 } from '../relational/weather/types';

export const DISCOVERY_BASE_WEIGHT = 0.6;
export const DISCOVERY_TRANSIT_WEIGHT = 0.4;
export const STRONG_TRANSIT_THRESHOLD = 0.6;

export type TransitAmplificationResult = {
  score: number;
  topHits: Array<{
    transitBody: string;
    natalBody: string;
    memberChartId: string;
    aspectType: string;
    weight: number;
  }>;
  hasStrongTransit: boolean;
};

export function blendDiscoveryDailyScore(baseScore: number, transitScore: number): number {
  return clamp01(baseScore * DISCOVERY_BASE_WEIGHT + transitScore * DISCOVERY_TRANSIT_WEIGHT);
}

/**
 * Build "now" in the seeker's timezone from chart birth location metadata.
 */
export async function resolveSeekerTransitInput(seekerChartId: string): Promise<DiscoveryTransitInput | null> {
  const chart = await getChartById(seekerChartId);
  if (!chart || typeof chart.lat !== 'number' || typeof chart.lon !== 'number') {
    return null;
  }
  const tz = chart.timezone?.trim() || 'UTC';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const y = pick('year');
  const mo = pick('month');
  const d = pick('day');
  const h = pick('hour');
  const mi = pick('minute');
  if (!y || !mo || !d) return null;
  return {
    date: `${y}-${mo}-${d}`,
    time: `${h || '00'}:${mi || '00'}`,
    lat: chart.lat,
    lon: chart.lon,
    timezone: tz,
  };
}

function mapTopHits(hits: CrossAspectHitV1[]): TransitAmplificationResult['topHits'] {
  return hits.slice(0, 3).map((h) => ({
    transitBody: h.transitBody,
    natalBody: h.natalBody,
    memberChartId: h.memberChartId,
    aspectType: h.type,
    weight: h.weight,
  }));
}

export async function computeTransitAmplification(params: {
  seekerChartId: string;
  candidateChartId: string;
  transitInput: DiscoveryTransitInput;
  /** Pre-warmed daily snapshot (avoids N ephemeris fetches per match batch). */
  transitSnapshot?: EphemerisSnapshot;
}): Promise<TransitAmplificationResult> {
  const empty: TransitAmplificationResult = {
    score: 0,
    topHits: [],
    hasStrongTransit: false,
  };

  try {
    const transitSnapshot =
      params.transitSnapshot ?? (await getOrFetchDailyTransitSnapshot(params.transitInput));

    const { field, transit_weather } = await computeCompatibilitySystem({
      chartIds: [params.seekerChartId, params.candidateChartId],
      relationshipBindingId: null,
      transitInput: params.transitInput,
      cachedTransitSnapshot: transitSnapshot,
    });

    const intensity = field.activation_overlay?.activation_vector?.intensity ?? 0;
    const score = clamp01(intensity);
    const topHits = mapTopHits(transit_weather?.aspects?.topCrossAspects ?? []);

    return {
      score,
      topHits,
      hasStrongTransit: score > STRONG_TRANSIT_THRESHOLD,
    };
  } catch (e) {
    console.warn(
      '[transit-amplification] failed',
      params.seekerChartId,
      params.candidateChartId,
      e instanceof Error ? e.message : e
    );
    return empty;
  }
}
