import { equalHouseCuspsFromAscendant } from './sandbox-equal-houses';
import type { SandboxSlotSnapshot } from '../types/sandbox';

export const DEFAULT_FREE_BUILD_ASC_DEG = 0;

export function dailyTransitBirthForBlankCanvas(): {
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone: string;
  houseSystem: string;
} {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: '12:00',
    lat: 29.42,
    lon: -98.49,
    timezone: 'America/Chicago',
    houseSystem: 'equal',
  };
}

/** Client-side wheel preview for blank canvas (equal houses from ascendant). */
export function buildBlankCanvasSnapshot(
  overrides: Record<string, { lon: number }> | undefined,
  ascLonDeg: number
): SandboxSlotSnapshot {
  const entries = Object.entries(overrides ?? {});
  return {
    planets: entries.map(([name, v]) => ({ name, lon: v.lon })),
    houses: equalHouseCuspsFromAscendant(ascLonDeg),
    aspects: [],
  };
}
