/**
 * Home page daily cache — one text + audio result per calendar day per ~city location.
 * Persists in localStorage across tab close and browser restart.
 */

export type HomeExplanationSection = {
  sectionId?: string;
  title: string;
  text?: string;
  bullets?: string[];
  planets?: string[];
};

/** Fixed wall-clock time for daily sky compose (report + Lyria); wheel may use UI time separately. */
export const HOME_DAILY_COMPOSE_TIME = '12:00';

export type HomeComposeCacheEntry = {
  sections: HomeExplanationSection[] | null;
  analysisText: string;
  exportId: string | null;
  chartData: unknown;
  composeHash: string;
  specVersion: string | null;
  /** Calendar date this entry belongs to (YYYY-MM-DD). */
  date: string;
  cachedAt: number;
  audioFailed?: boolean;
  audioFailedReason?: string | null;
};

function homeComposeKey(dateStr: string, lat: number, lon: number): string {
  const latR = Math.round(lat * 10) / 10;
  const lonR = Math.round(lon * 10) / 10;
  return `astradio_home_${dateStr}_${latR}_${lonR}`;
}

function cleanExpiredHomeCache(currentDate: string): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('astradio_home_') && !key.includes(currentDate)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function getHomeCache(
  dateStr: string,
  lat: number,
  lon: number
): HomeComposeCacheEntry | null {
  if (typeof window === 'undefined') return null;
  const key = homeComposeKey(dateStr, lat, lon);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeComposeCacheEntry;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.date !== dateStr) {
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

export function setHomeCache(
  dateStr: string,
  lat: number,
  lon: number,
  entry: HomeComposeCacheEntry
): void {
  if (typeof window === 'undefined') return;
  const key = homeComposeKey(dateStr, lat, lon);
  try {
    cleanExpiredHomeCache(dateStr);
    localStorage.setItem(key, JSON.stringify({ ...entry, date: dateStr, cachedAt: Date.now() }));
  } catch {
    /* quota — ignore */
  }
}

export function updateHomeCacheAudio(
  dateStr: string,
  lat: number,
  lon: number,
  exportId: string | null,
  audioFailed: boolean,
  audioFailedReason: string | null
): void {
  const existing = getHomeCache(dateStr, lat, lon);
  if (!existing) return;
  setHomeCache(dateStr, lat, lon, {
    ...existing,
    exportId,
    audioFailed,
    audioFailedReason,
  });
}
