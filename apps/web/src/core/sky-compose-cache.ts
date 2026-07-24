/**
 * Universal sky summary daily cache — one result per calendar day per ~location.
 * Not chart-specific; sky positions are the same for everyone at the same place and date.
 */

const KEY_PREFIX = 'astradio_sky_v2_';

import type { ComposeVisualControls } from './compose-visual-controls';
import type { AuraRawSnapshot } from '@/components/wheel/aura-raw-snapshot';

export type SkyCachePayload = {
  explanationSections: unknown;
  analysisText: string;
  chartData: unknown;
  composeHash: string;
  composeControls?: ComposeVisualControls | null;
  rawSnapshot?: AuraRawSnapshot | null;
  date: string;
  lat: number;
  lon: number;
};

export type SkyCacheEntry = SkyCachePayload & {
  cachedAt: number;
};

function roundCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

function skyComposeKey(dateStr: string, lat: number, lon: number): string {
  const latR = roundCoord(lat);
  const lonR = roundCoord(lon);
  return `${KEY_PREFIX}${dateStr}_${latR}_${lonR}`;
}

function parseDateFromKey(key: string): string | null {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const rest = key.slice(KEY_PREFIX.length);
  const dateEnd = rest.indexOf('_');
  if (dateEnd <= 0) return null;
  return rest.slice(0, dateEnd);
}

/** Remove sky cache entries whose calendar date is not today. */
export function cleanExpiredSkyCache(currentDate: string): void {
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

export function getSkyCache(dateStr: string, lat: number, lon: number): SkyCacheEntry | null {
  if (typeof window === 'undefined') return null;
  const latR = roundCoord(lat);
  const lonR = roundCoord(lon);
  const key = skyComposeKey(dateStr, lat, lon);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SkyCacheEntry;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.date !== dateStr || parsed.lat !== latR || parsed.lon !== lonR) {
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

export function setSkyCache(
  dateStr: string,
  lat: number,
  lon: number,
  payload: SkyCachePayload
): void {
  if (typeof window === 'undefined') return;
  const key = skyComposeKey(dateStr, lat, lon);
  try {
    cleanExpiredSkyCache(dateStr);
    const latR = roundCoord(lat);
    const lonR = roundCoord(lon);
    const entry: SkyCacheEntry = {
      ...payload,
      date: dateStr,
      lat: latR,
      lon: lonR,
      cachedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* quota — ignore */
  }
}
