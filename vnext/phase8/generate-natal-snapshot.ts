// vnext/phase8/generate-natal-snapshot.ts
// Phase 8 — generate canonical natal EphemerisSnapshot via Swiss Ephemeris (chart-snapshot API).

import type { EphemerisSnapshot } from '../contracts';
import type { ChartInput } from '../core/architecture-engine';
import { fetchChartSnapshot } from '../core/architecture-engine';

export interface MinimalProfileBirthData {
  birth_date: string;
  birth_time: string;
  // birth_location is descriptive only for Phase 8 test; lat/lon are provided separately.
  birth_location: string;
  lat: number;
  lon: number;
  timezone?: string;
}

export async function generateNatalSnapshot(profile: MinimalProfileBirthData): Promise<EphemerisSnapshot> {
  const input: ChartInput = {
    date: profile.birth_date,
    time: profile.birth_time,
    lat: profile.lat,
    lon: profile.lon,
    timezone: profile.timezone ?? 'UTC',
  };
  return fetchChartSnapshot(input);
}

