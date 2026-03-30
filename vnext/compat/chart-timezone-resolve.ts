/**
 * Single chart timezone resolver — mandatory order:
 * 1) valid client IANA (timezone or tz) → use it
 * 2) else lat/lon finite → tzlookup + IANA validation
 * 3) else fail closed (no UTC or server defaults)
 *
 * Canonical implementation (compiled to dist). lib/chart-timezone-resolve.js loads this after vnext:build.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const tzlookup = require('tzlookup') as { tzNameAt: (lat: number, lon: number) => string };
const moment = require('moment-timezone');

export function isValidIanaTimezone(name: string | null | undefined): boolean {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (!t) return false;
  return Boolean(moment.tz.zone(t));
}

export type ChartTimezoneInsertInput = {
  timezone?: string | null;
  tz?: string | null;
  lat: number;
  lon: number;
};

export function resolveChartTimezoneForChartInsert(input: ChartTimezoneInsertInput): string {
  const clientRaw = input.timezone != null ? input.timezone : input.tz;
  if (clientRaw != null && String(clientRaw).trim()) {
    const c = String(clientRaw).trim();
    if (isValidIanaTimezone(c)) return c;
    const err = new Error('Invalid IANA timezone') as Error & { code?: string };
    err.code = 'INVALID_CHART_TIMEZONE';
    throw err;
  }

  const lat = input.lat;
  const lon = input.lon;
  if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
    let name: string;
    try {
      name = tzlookup.tzNameAt(lat, lon);
    } catch (e) {
      const err = new Error('Geographic timezone lookup failed') as Error & { code?: string; cause?: unknown };
      err.code = 'CHART_TIMEZONE_UNRESOLVABLE';
      err.cause = e;
      throw err;
    }
    if (name && typeof name === 'string' && name.trim() && isValidIanaTimezone(name)) {
      return name.trim();
    }
    const err = new Error('Geographic timezone lookup produced invalid or empty zone') as Error & { code?: string };
    err.code = 'CHART_TIMEZONE_UNRESOLVABLE';
    throw err;
  }

  const err = new Error('Timezone required: provide valid IANA timezone or valid lat/lon') as Error & { code?: string };
  err.code = 'CHART_TIMEZONE_UNRESOLVABLE';
  throw err;
}
