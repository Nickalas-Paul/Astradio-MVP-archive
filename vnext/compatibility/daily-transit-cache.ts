/**
 * Daily transit ephemeris cache (c(T)) for Discovery matching.
 * Redis when REDIS_URL is set; otherwise in-process Map with TTL.
 */

import type { EphemerisSnapshot } from '../contracts';
import { fetchChartSnapshot, type ChartInput } from '../core/architecture-engine';

export type DiscoveryTransitInput = {
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
};

const TTL_SECONDS = 86400;

type MemoryEntry = { snapshot: EphemerisSnapshot; expiresAt: number };

const memoryCache = new Map<string, MemoryEntry>();

function cacheKey(input: DiscoveryTransitInput): string {
  const tz = input.timezone?.trim() || 'UTC';
  return `transits:daily:${input.date}:${input.time}:${input.lat.toFixed(4)}:${input.lon.toFixed(4)}:${tz}`;
}

function toChartInput(input: DiscoveryTransitInput): ChartInput {
  return {
    date: input.date,
    time: input.time.length >= 5 ? input.time.slice(0, 5) : input.time,
    lat: input.lat,
    lon: input.lon,
    ...(input.timezone?.trim() ? { timezone: input.timezone.trim() } : {}),
  };
}

async function redisGet(key: string): Promise<EphemerisSnapshot | null> {
  if (!process.env.REDIS_URL) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const redis = require('../../../lib/redis');
    return (await redis.get(key)) as EphemerisSnapshot | null;
  } catch (e) {
    console.warn('[daily-transit-cache] Redis get failed', e instanceof Error ? e.message : e);
    return null;
  }
}

async function redisSet(key: string, snapshot: EphemerisSnapshot): Promise<void> {
  if (!process.env.REDIS_URL) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const redis = require('../../../lib/redis');
    await redis.set(key, snapshot, TTL_SECONDS);
  } catch (e) {
    console.warn('[daily-transit-cache] Redis set failed', e instanceof Error ? e.message : e);
  }
}

/**
 * Fetch today's transit snapshot once per day/location bucket (cached).
 */
export async function getOrFetchDailyTransitSnapshot(
  input: DiscoveryTransitInput
): Promise<EphemerisSnapshot> {
  const key = cacheKey(input);
  const now = Date.now();

  const mem = memoryCache.get(key);
  if (mem && mem.expiresAt > now) {
    return mem.snapshot;
  }

  const fromRedis = await redisGet(key);
  if (fromRedis) {
    memoryCache.set(key, { snapshot: fromRedis, expiresAt: now + TTL_SECONDS * 1000 });
    return fromRedis;
  }

  const snapshot = await fetchChartSnapshot(toChartInput(input));
  memoryCache.set(key, { snapshot, expiresAt: now + TTL_SECONDS * 1000 });
  await redisSet(key, snapshot);
  return snapshot;
}

/** Warm cache before a batch of transit amplification calls. */
export async function warmDailyTransitCache(input: DiscoveryTransitInput): Promise<EphemerisSnapshot> {
  return getOrFetchDailyTransitSnapshot(input);
}

/** Test helper */
export function clearDailyTransitCacheForTests(): void {
  memoryCache.clear();
}
