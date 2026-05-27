/**
 * Home page compose session cache — one entry per sky-moment (date + hour + ~city location).
 */

export type HomeExplanationSection = {
  sectionId?: string;
  title: string;
  text?: string;
  bullets?: string[];
};

export type HomeComposeCacheEntry = {
  sections: HomeExplanationSection[] | null;
  analysisText: string;
  exportId: string | null;
  chartData: unknown;
  composeHash: string;
  specVersion: string | null;
  cachedAt: number;
};

/** Round time to the hour for guest sky-moment bucketing. */
export function homeComposeTimeHour(timeStr: string): string {
  const hour = (timeStr.split(':')[0] ?? '12').padStart(2, '0');
  return `${hour}:00`;
}

export function homeComposeCacheKey(
  dateStr: string,
  timeStr: string,
  lat: number,
  lon: number
): string {
  const hour = homeComposeTimeHour(timeStr).split(':')[0];
  const latRound = Math.round(lat * 10) / 10;
  const lonRound = Math.round(lon * 10) / 10;
  return `astradio_home_${dateStr}_${hour}_${latRound}_${lonRound}`;
}

export function readHomeComposeCache(key: string): HomeComposeCacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeComposeCacheEntry;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function writeHomeComposeCache(key: string, entry: HomeComposeCacheEntry): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* quota — ignore */
  }
}

export function patchHomeComposeCacheExportId(key: string, exportId: string): void {
  const existing = readHomeComposeCache(key);
  if (!existing) return;
  writeHomeComposeCache(key, { ...existing, exportId, cachedAt: Date.now() });
}
