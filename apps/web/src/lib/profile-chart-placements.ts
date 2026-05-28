/**
 * Build selectable chart highlight labels from a natal snapshot (client-side).
 */

import { normalizeChartForWheel } from '../core/chart-adapter';

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

const ORDINAL_HOUSE = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
] as const;

const PLANET_KEYS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const;

const PLANET_LABEL: Record<string, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
};

const NODE_KEYS = ['northnode', 'north_node', 'meannode', 'true_node'];

function normLon(lon: number): number {
  let x = lon % 360;
  if (x < 0) x += 360;
  return x;
}

function lonToSign(lon: number): string {
  const x = normLon(lon);
  return ZODIAC_SIGNS[Math.floor(x / 30) % 12];
}

function lonToHouse(lon: number, cusps: number[]): number {
  if (!cusps || cusps.length < 12) return 1;
  const x = normLon(lon);
  for (let i = 0; i < 12; i++) {
    const cStart = normLon(cusps[i]!);
    const cEnd = normLon(cusps[(i + 1) % 12]!);
    const inSegment = cStart <= cEnd ? x >= cStart && x < cEnd : x >= cStart || x < cEnd;
    if (inSegment) return i + 1;
  }
  return 1;
}

function houseLabel(house: number): string {
  return `${ORDINAL_HOUSE[Math.min(11, Math.max(0, house - 1))]} House`;
}

function planetPlacement(planetName: string, lon: number, cusps: number[]): string {
  const sign = lonToSign(lon);
  const house = lonToHouse(lon, cusps);
  return `${planetName} in ${sign}, ${houseLabel(house)}`;
}

function collectPositions(raw: Record<string, unknown>): Record<string, number> {
  const positions: Record<string, number> = {};

  if (raw.positions != null && typeof raw.positions === 'object' && !Array.isArray(raw.positions)) {
    for (const [k, v] of Object.entries(raw.positions as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      if (Number.isFinite(n)) positions[k.toLowerCase()] = n;
    }
  }

  if (Array.isArray(raw.planets)) {
    for (const entry of raw.planets) {
      if (!entry || typeof entry !== 'object') continue;
      const name = String((entry as { name?: string }).name ?? '').toLowerCase();
      const lon =
        (entry as { lon?: number }).lon ?? (entry as { longitude?: number }).longitude;
      if (name && typeof lon === 'number' && Number.isFinite(lon)) {
        positions[name] = lon;
      }
    }
  }

  return positions;
}

/**
 * Returns ordered placement strings for highlight chips (empty if chart data unavailable).
 */
export function buildChartPlacementOptions(snapshot: unknown): string[] {
  const wheel = normalizeChartForWheel(snapshot);
  if (!wheel) return [];

  const raw = snapshot as Record<string, unknown>;
  const positions = collectPositions(raw);
  for (const [k, v] of Object.entries(wheel.positions)) {
    if (!positions[k.toLowerCase()]) positions[k.toLowerCase()] = v;
  }

  const cusps = wheel.cusps;
  const options: string[] = [];

  const ascLon = typeof wheel.asc === 'number' ? wheel.asc : cusps[0]!;
  options.push(`${lonToSign(ascLon)} Rising`);

  const mcLon = cusps[9]!;
  options.push(`Midheaven in ${lonToSign(mcLon)}`);

  for (const key of PLANET_KEYS) {
    const lon = positions[key];
    if (lon == null || !Number.isFinite(lon)) continue;
    const label = PLANET_LABEL[key];
    if (label) options.push(planetPlacement(label, lon, cusps));
  }

  for (const key of NODE_KEYS) {
    const lon = positions[key];
    if (lon == null || !Number.isFinite(lon)) continue;
    const sign = lonToSign(lon);
    const house = lonToHouse(lon, cusps);
    options.push(`North Node in ${sign}, ${houseLabel(house)}`);
    break;
  }

  return options;
}
