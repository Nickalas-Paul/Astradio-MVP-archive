/**
 * Synthetic daily transit birth for blank-canvas (Path A) generate — satisfies snapshot/resolve gates
 * without exposing birth data in the UI. Matches Home page compose time (12:00) and default location.
 */

import type { CanonicalLocation } from '../types/location';
import type { EphemerisSnapshot, SandboxBirth } from '../types/sandbox';
import { equalHouseCuspsFromAscendant } from './equal-house-cusps';

/** Same fallback as Home page when geolocation is unavailable. */
export const DEFAULT_TRANSIT_LOCATION: CanonicalLocation = {
  source: 'geofinder',
  label: 'Texas, United States',
  lat: 29.42,
  lon: -98.49,
  timezone: 'America/Chicago',
  resolvedAt: new Date(0).toISOString(),
};

/** Fixed wall-clock time for daily transit — matches HOME_DAILY_COMPOSE_TIME on Home. */
export const DAILY_TRANSIT_COMPOSE_TIME = '12:00';

export function dailyTransitBirth(location: CanonicalLocation = DEFAULT_TRANSIT_LOCATION): SandboxBirth {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  return {
    date,
    time: DAILY_TRANSIT_COMPOSE_TIME,
    location: {
      ...location,
      resolvedAt: new Date().toISOString(),
    },
    houseSystem: 'placidus',
  };
}

/** Replace Placidus cusps with equal houses from the user's blank-canvas ASC (Path A only). */
export function applyBlankCanvasEqualHouses(
  snapshot: EphemerisSnapshot,
  ascLonDeg: number
): EphemerisSnapshot {
  const cusps = equalHouseCuspsFromAscendant(ascLonDeg);
  return {
    ...snapshot,
    houses: cusps as EphemerisSnapshot['houses'],
    houseSystem: 'equal',
  };
}
