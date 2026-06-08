/**
 * Personal transit daily cache — one active-state result per calendar day per chart + ~location.
 * Persists in localStorage across tab close and browser restart.
 */

import type { CanonicalLocation } from '../types/location';

const KEY_PREFIX = 'astradio_transit_';

export type TransitComposeCacheEntry = {
  /** Calendar date this entry belongs to (YYYY-MM-DD). */
  date: string;
  chartId: string;
  lat: number;
  lon: number;
  calendarDate: string;
  localTime: string;
  location: CanonicalLocation;
  /** Full POST /api/profile/active-state response (text-only). */
  activeState: Record<string, unknown>;
  cachedAt: number;
};

function roundCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

function transitComposeKey(dateStr: string, chartId: string, lat: number, lon: number): string {
  const latR = roundCoord(lat);
  const lonR = roundCoord(lon);
  return `${KEY_PREFIX}${dateStr}_${chartId}_${latR}_${lonR}`;
}

function parseDateFromKey(key: string): string | null {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const rest = key.slice(KEY_PREFIX.length);
  const dateEnd = rest.indexOf('_');
  if (dateEnd <= 0) return null;
  return rest.slice(0, dateEnd);
}

/** Remove transit cache entries whose calendar date is not today. */
export function cleanExpiredTransitCache(currentDate: string): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      const date = parseDateFromKey(key);
      if (date && date !== currentDate) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function getTransitCache(
  dateStr: string,
  chartId: string,
  lat: number,
  lon: number
): TransitComposeCacheEntry | null {
  if (typeof window === 'undefined') return null;
  const key = transitComposeKey(dateStr, chartId, lat, lon);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TransitComposeCacheEntry;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.date !== dateStr || parsed.chartId !== chartId) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function setTransitCache(
  dateStr: string,
  chartId: string,
  lat: number,
  lon: number,
  entry: Omit<TransitComposeCacheEntry, 'date' | 'chartId' | 'lat' | 'lon' | 'cachedAt'>
): void {
  if (typeof window === 'undefined') return;
  const key = transitComposeKey(dateStr, chartId, lat, lon);
  try {
    cleanExpiredTransitCache(dateStr);
    const payload: TransitComposeCacheEntry = {
      ...entry,
      date: dateStr,
      chartId,
      lat: roundCoord(lat),
      lon: roundCoord(lon),
      cachedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota — ignore */
  }
}

/** Clear all location variants for a chart on a given calendar day (e.g. after location change). */
export function clearTransitCacheForDate(dateStr: string, chartId: string): void {
  if (typeof window === 'undefined') return;
  const needle = `${KEY_PREFIX}${dateStr}_${chartId}_`;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(needle)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
