// Single source of truth for Swiss Ephemeris calculations
// Deterministic astrological calculations with caching

import { generateChartHashSync } from '../../lib/hash/chartHash';

const swe = require('swisseph');
const moment = require('moment-timezone');
const tzlookup = require('tzlookup');

export interface ChartData {
  date: string;
  time: string;
  lat: number;
  lon: number;
}

export interface PlanetPosition {
  planet: string;
  longitude: number;
  latitude: number;
  distance: number;
  speed: number;
}

export interface HouseCusp {
  house: number;
  longitude: number;
}

export interface EphemerisResult {
  date: string;
  time: string;
  lat: number;
  lon: number;
  positions: PlanetPosition[];
  cusps: HouseCusp[];
  cached: boolean;
}

// Cache for deterministic results
const resultCache = new Map<string, { timestamp: number; result: EphemerisResult }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Convert date/time to Julian Day UT
 */
function toJulianDayUT(date: string, time: string, lat?: number, lon?: number): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  
  const momentDate = moment.utc([year, month - 1, day, hour, minute, second]);
  return momentDate.valueOf() / 86400000 + 2440587.5; // Convert to Julian Day
}

/**
 * Calculate planet positions
 */
function calcPositions(jd: number, includeExtras = true): PlanetPosition[] {
  const planets = [
    { id: swe.SE_SUN, name: 'Sun' },
    { id: swe.SE_MOON, name: 'Moon' },
    { id: swe.SE_MERCURY, name: 'Mercury' },
    { id: swe.SE_VENUS, name: 'Venus' },
    { id: swe.SE_MARS, name: 'Mars' },
    { id: swe.SE_JUPITER, name: 'Jupiter' },
    { id: swe.SE_SATURN, name: 'Saturn' },
    { id: swe.SE_URANUS, name: 'Uranus' },
    { id: swe.SE_NEPTUNE, name: 'Neptune' },
    { id: swe.SE_PLUTO, name: 'Pluto' }
  ];

  const positions: PlanetPosition[] = [];

  for (const planet of planets) {
    try {
      const result = swe.calc_ut(jd, planet.id, swe.FLG_SWIEPH);
      positions.push({
        planet: planet.name,
        longitude: result.longitude,
        latitude: result.latitude,
        distance: result.distance,
        speed: result.speed
      });
    } catch (error) {
      console.warn(`Failed to calculate position for ${planet.name}:`, error);
    }
  }

  return positions;
}

/**
 * Calculate Placidus house cusps
 */
function calcPlacidusCusps(jd: number, lat: number, lon: number): HouseCusp[] {
  try {
    const cusps = swe.houses(jd, lat, lon, 'P'); // Placidus houses
    const houseCusps: HouseCusp[] = [];
    
    for (let i = 0; i < 12; i++) {
      houseCusps.push({
        house: i + 1,
        longitude: cusps.cusps[i + 1] // cusps[0] is not used
      });
    }
    
    return houseCusps;
  } catch (error) {
    console.warn('Failed to calculate Placidus cusps, using equal houses:', error);
    // Fallback to equal houses
    return Array.from({ length: 12 }, (_, i) => ({
      house: i + 1,
      longitude: i * 30
    }));
  }
}

/**
 * Calculate equal house cusps (no location needed)
 */
function calcEqualHouseCusps(): HouseCusp[] {
  return Array.from({ length: 12 }, (_, i) => ({
    house: i + 1,
    longitude: i * 30
  }));
}

/**
 * Get chart data with caching
 */
export async function getChartData(chartData: ChartData, includeExtras = true): Promise<EphemerisResult> {
  const { date, time, lat, lon } = chartData;
  
  // Generate cache key
  const cacheKey = generateChartHashSync({ date, time, lat, lon, includeExtras });
  
  // Check cache
  const cached = resultCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }
  
  // Calculate new result
  const jd = toJulianDayUT(date, time, lat, lon);
  const positions = calcPositions(jd, includeExtras);
  const cusps = calcPlacidusCusps(jd, lat, lon);
  
  const result: EphemerisResult = {
    date,
    time,
    lat,
    lon,
    positions,
    cusps,
    cached: false
  };
  
  // Cache result
  resultCache.set(cacheKey, { timestamp: now, result });
  
  return result;
}

/**
 * Get planet positions only (no houses)
 */
export async function getPlanetPositions(chartData: ChartData, includeExtras = true): Promise<EphemerisResult> {
  const { date, time } = chartData;
  
  // Generate cache key
  const cacheKey = generateChartHashSync({ date, time, includeExtras, type: 'positions' });
  
  // Check cache
  const cached = resultCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }
  
  // Calculate new result
  const jd = toJulianDayUT(date, time);
  const positions = calcPositions(jd, includeExtras);
  const cusps = calcEqualHouseCusps();
  
  const result: EphemerisResult = {
    date,
    time,
    lat: 0,
    lon: 0,
    positions,
    cusps,
    cached: false
  };
  
  // Cache result
  resultCache.set(cacheKey, { timestamp: now, result });
  
  return result;
}

/**
 * Clear cache (for testing)
 */
export function clearCache(): void {
  resultCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: resultCache.size,
    keys: Array.from(resultCache.keys())
  };
}
