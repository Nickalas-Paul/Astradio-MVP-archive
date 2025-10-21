// Single source of truth for chart hash generation
// Deterministic hashing for astrological chart data

import { sha256Hex, stableStringify } from '../../src/core/hash';

export interface ChartData {
  date: string;
  time: string;
  lat: number;
  lon: number;
  [key: string]: any;
}

export interface ComparisonData {
  requester: ChartData;
  target: ChartData;
  [key: string]: any;
}

/**
 * Generate deterministic hash for chart data
 * Used for deduplication and caching
 */
export async function generateChartHash(chartData: ChartData | ComparisonData): Promise<string> {
  const normalized = stableStringify(chartData);
  return await sha256Hex(normalized);
}

/**
 * Synchronous version for compatibility
 */
export function generateChartHashSync(chartData: ChartData | ComparisonData): string {
  const normalized = stableStringify(chartData);
  // Use crypto.createHash for sync version
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
