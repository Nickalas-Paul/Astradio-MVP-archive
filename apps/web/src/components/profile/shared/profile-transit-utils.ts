import type { CanonicalLocation } from '../../../types/location';

export const SAVE_DUP_PREFIX = 'profile_transit_save_dup_v1|';

export function normalizeLocalTime(t: string): string {
  return t.length === 5 ? t : t.slice(0, 5);
}

export function parseSnapshotFingerprint(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isValidTransitLocationSource(s: unknown): s is CanonicalLocation['source'] {
  return s === 'browser_geo' || s === 'geofinder';
}

export function sandboxStateCompleteForTransit(
  s: Record<string, unknown>,
): s is {
  kind: string;
  chartId: string;
  calendarDate: string;
  localTime: string;
  location: CanonicalLocation;
} {
  if (s.kind !== 'profile_active' || typeof s.chartId !== 'string') return false;
  if (typeof s.calendarDate !== 'string' || typeof s.localTime !== 'string') return false;
  const loc = s.location;
  if (!loc || typeof loc !== 'object') return false;
  const L = loc as Record<string, unknown>;
  return (
    isValidTransitLocationSource(L.source) &&
    typeof L.label === 'string' &&
    typeof L.lat === 'number' &&
    Number.isFinite(L.lat) &&
    typeof L.lon === 'number' &&
    Number.isFinite(L.lon) &&
    typeof L.timezone === 'string' &&
    L.timezone.length > 0 &&
    typeof L.resolvedAt === 'string' &&
    L.resolvedAt.length > 0
  );
}

export function snapshotSafeForWheel(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const o = snapshot as Record<string, unknown>;
  const planets = o.planets ?? o.positions;
  const houses = o.houses ?? o.cusps;
  const hasPlanets = Array.isArray(planets) && planets.length > 0;
  const hasHouses = Array.isArray(houses) && houses.length >= 12;
  return hasPlanets || hasHouses;
}
