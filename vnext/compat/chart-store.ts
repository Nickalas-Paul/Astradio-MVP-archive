/**
 * Unified chart store — single interface for chart resolution.
 * Used by personality, compat, and chart CRUD. Delegates to storage (async).
 */

import type { Chart, ChartBInline } from './types';
import * as storage from './storage';

export type ChartInput = {
  ownerId?: string;
  label: string;
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
  /** Alias for `timezone` (community clients). */
  tz?: string;
  snapshotHash?: string;
};

export type ResolveChartInput =
  | { chartId: string }
  | { chartInline: ChartBInline };

export async function getChartById(chartId: string): Promise<Chart | undefined> {
  return storage.getChart(chartId);
}

export async function createChart(input: ChartInput, ownerId?: string): Promise<Chart> {
  return storage.createChart({
    ...input,
    ownerId: ownerId ?? input.ownerId,
  });
}

export async function listChartsByOwner(ownerId: string): Promise<Chart[]> {
  return storage.listChartsByOwner(ownerId);
}

export async function resolveChartOrInline(input: ResolveChartInput): Promise<Chart> {
  if ('chartId' in input) {
    const c = await storage.getChart(input.chartId);
    if (!c) throw new Error(`Chart not found: ${input.chartId}`);
    return c;
  }
  const inline = input.chartInline;
  if (!inline || !inline.date || !inline.time || typeof inline.lat !== 'number' || typeof inline.lon !== 'number') {
    throw new Error('chartInline must have date, time, lat, lon');
  }
  return storage.createChart({
    label: inline.label ?? 'Chart B',
    date: inline.date,
    time: inline.time,
    lat: inline.lat,
    lon: inline.lon,
    timezone: inline.timezone ?? inline.tz,
  });
}

export { storage };
export { ensureDefaultProfileChart, ensureMatchCandidateCharts, DEFAULT_PROFILE_CHART_ID } from './storage';
export type { MatchCandidate } from './storage';
