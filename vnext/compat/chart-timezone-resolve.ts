/**
 * Single chart timezone resolver — mandatory order:
 * 1) valid client IANA that is not a UTC placeholder → use it
 * 2) if client omitted IANA or sent a UTC placeholder (UTC, Etc/UTC, GMT, …) and lat/lon are finite → tzlookup + IANA validation
 * 3) else fail closed (no UTC or server defaults for ambiguous birth data)
 *
 * UTC-equivalent client zones are never accepted as final birth truth when coordinates can resolve a geographic zone.
 *
 * Canonical source (no dist/ at runtime for this module). Next bundles this file directly.
 * Node/pg-store uses lib/chart-timezone-resolve.js, which re-requires the compiled copy after vnext:build only on the engine.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const tzlookup = require('tzlookup') as { tzNameAt: (lat: number, lon: number) => string };
const moment = require('moment-timezone');

import { isUtcEquivalentChartTimezone as utcEquivalent } from './utc-equivalent-timezone';

export { isUtcEquivalentChartTimezone } from './utc-equivalent-timezone';

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

function resolveTimezoneFromLatLon(lat: number, lon: number): string {
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

export function resolveChartTimezoneForChartInsert(input: ChartTimezoneInsertInput): string {
  const lat = input.lat;
  const lon = input.lon;
  const coordsOk = typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon);

  const clientRaw = input.timezone != null ? input.timezone : input.tz;
  const trimmed = clientRaw != null ? String(clientRaw).trim() : '';

  if (trimmed) {
    if (!isValidIanaTimezone(trimmed)) {
      const err = new Error('Invalid IANA timezone') as Error & { code?: string };
      err.code = 'INVALID_CHART_TIMEZONE';
      throw err;
    }
    if (utcEquivalent(trimmed)) {
      if (coordsOk) {
        return resolveTimezoneFromLatLon(lat, lon);
      }
      const err = new Error(
        'UTC or GMT placeholder timezone is not valid for birth charts without resolvable coordinates'
      ) as Error & { code?: string };
      err.code = 'CHART_TIMEZONE_UNRESOLVABLE';
      throw err;
    }
    return trimmed;
  }

  if (coordsOk) {
    return resolveTimezoneFromLatLon(lat, lon);
  }

  const err = new Error('Timezone required: provide valid IANA timezone or valid lat/lon') as Error & { code?: string };
  err.code = 'CHART_TIMEZONE_UNRESOLVABLE';
  throw err;
}
