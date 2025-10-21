// Compatibility Cache Management
// Fast cache for precomputed matches

import type { CompatMatch, CompatCacheEntry, ChartID, CompatFacet } from '../../src/core/compat/types';

// In-memory cache - replace with Redis in production
const CACHE = new Map<string, CompatCacheEntry[]>();
const CACHE_TIMESTAMPS = new Map<string, number>();

// Cache TTL (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Generate cache key
function getCacheKey(chartId: ChartID, facet: CompatFacet): string {
  return `${chartId}:${facet}`;
}

// Check if cache entry is valid
function isCacheValid(key: string): boolean {
  const timestamp = CACHE_TIMESTAMPS.get(key);
  if (!timestamp) return false;
  
  return Date.now() - timestamp < CACHE_TTL;
}

// Get cached matches
export async function getCachedMatches(
  chartId: ChartID, 
  facet: CompatFacet, 
  limit: number = 10
): Promise<CompatMatch[]> {
  const key = getCacheKey(chartId, facet);
  
  if (!isCacheValid(key)) {
    return [];
  }
  
  const cached = CACHE.get(key);
  if (!cached) {
    return [];
  }
  
  // Return matches up to limit
  return cached.slice(0, limit).map(entry => ({
    targetUserId: entry.targetUserId,
    targetChartId: entry.targetChartId,
    facet: entry.facet,
    score: entry.score,
    rationale: entry.rationale,
    previewCompId: undefined // TODO: Add preview composition ID
  }));
}

// Set cached matches
export async function setCachedMatches(
  chartId: ChartID, 
  facet: CompatFacet, 
  matches: CompatMatch[]
): Promise<void> {
  const key = getCacheKey(chartId, facet);
  
  const entries: CompatCacheEntry[] = matches.map((match, index) => ({
    chartId,
    facet,
    rank: index + 1,
    targetUserId: match.targetUserId,
    targetChartId: match.targetChartId,
    score: match.score,
    rationale: match.rationale,
    updatedAt: new Date().toISOString()
  }));
  
  CACHE.set(key, entries);
  CACHE_TIMESTAMPS.set(key, Date.now());
}

// Invalidate cache for a chart
export async function invalidateCache(chartId: ChartID): Promise<void> {
  const facets: CompatFacet[] = ['friends', 'lovers', 'creative', 'mentor', 'conflict', 'overall'];
  
  for (const facet of facets) {
    const key = getCacheKey(chartId, facet);
    CACHE.delete(key);
    CACHE_TIMESTAMPS.delete(key);
  }
}

// Invalidate cache for a specific chart/facet
export async function invalidateCacheForFacet(chartId: ChartID, facet: CompatFacet): Promise<void> {
  const key = getCacheKey(chartId, facet);
  CACHE.delete(key);
  CACHE_TIMESTAMPS.delete(key);
}

// Clear all cache
export async function clearAllCache(): Promise<void> {
  CACHE.clear();
  CACHE_TIMESTAMPS.clear();
}

// Get cache statistics
export function getCacheStats(): {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  memoryUsage: number;
} {
  const totalEntries = CACHE.size;
  let validEntries = 0;
  let expiredEntries = 0;
  
  for (const [key, timestamp] of CACHE_TIMESTAMPS.entries()) {
    if (isCacheValid(key)) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  // Estimate memory usage (rough calculation)
  let memoryUsage = 0;
  for (const [key, entries] of CACHE.entries()) {
    memoryUsage += key.length * 2; // UTF-16 characters
    memoryUsage += entries.length * 200; // Rough estimate per entry
  }
  
  return {
    totalEntries,
    validEntries,
    expiredEntries,
    memoryUsage
  };
}

// Clean expired entries
export function cleanExpiredEntries(): number {
  let cleaned = 0;
  
  for (const [key, timestamp] of CACHE_TIMESTAMPS.entries()) {
    if (!isCacheValid(key)) {
      CACHE.delete(key);
      CACHE_TIMESTAMPS.delete(key);
      cleaned++;
    }
  }
  
  return cleaned;
}

// Get cache hit rate (mock implementation)
export function getCacheHitRate(): number {
  // In a real implementation, this would track hits/misses
  return 0.85; // 85% hit rate
}

// Warm cache for a chart
export async function warmCache(chartId: ChartID, facets: CompatFacet[] = ['overall']): Promise<void> {
  // This would trigger background computation of matches
  // For now, just ensure cache keys exist
  for (const facet of facets) {
    const key = getCacheKey(chartId, facet);
    if (!CACHE.has(key)) {
      // TODO: Trigger background job to compute matches
      console.log(`Warming cache for ${chartId}:${facet}`);
    }
  }
}

// Export cache operations for testing
export {
  getCacheKey,
  isCacheValid,
  CACHE_TTL
};
