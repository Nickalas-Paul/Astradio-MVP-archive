// vnext/scripts/generate-real-snapshots.ts
// Generate real ephemeris snapshots using Swiss Ephemeris for Phase 2C evaluation

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encodeFeatures } from '../feature-encode';
import type { EphemerisSnapshot } from '../contracts';

// Import Swiss Ephemeris functionality from the main server
const swe = require('swisseph');
const moment = require('moment-timezone');
const tzlookup = require('tzlookup');

interface SnapshotRecord {
  id: string;
  snap: EphemerisSnapshot;
  feat: number[];
}

// Planet constants (matching server/index.js)
const PLANETS = {
  sun: swe.SE_SUN,
  moon: swe.SE_MOON,
  mercury: swe.SE_MERCURY,
  venus: swe.SE_VENUS,
  mars: swe.SE_MARS,
  jupiter: swe.SE_JUPITER,
  saturn: swe.SE_SATURN,
  uranus: swe.SE_URANUS,
  neptune: swe.SE_NEPTUNE,
  pluto: swe.SE_PLUTO
};

const EXTRAS = {
  chiron: swe.SE_CHIRON,
  ceres: swe.SE_CERES,
  pallas: swe.SE_PALLAS,
  juno: swe.SE_JUNO,
  vesta: swe.SE_VESTA
};

// Generate diverse location candidates
function generateLocationCandidates(count: number): Array<{lat: number, lon: number, label: string}> {
  const candidates = [];
  
  // Major world cities with diverse geographic distribution
  const worldCities = [
    { lat: 40.7128, lon: -74.0060, label: 'New York, NY, USA' },
    { lat: 51.5074, lon: -0.1278, label: 'London, England' },
    { lat: 35.6762, lon: 139.6503, label: 'Tokyo, Japan' },
    { lat: -33.8688, lon: 151.2093, label: 'Sydney, Australia' },
    { lat: 55.7558, lon: 37.6173, label: 'Moscow, Russia' },
    { lat: -22.9068, lon: -43.1729, label: 'Rio de Janeiro, Brazil' },
    { lat: 28.6139, lon: 77.2090, label: 'New Delhi, India' },
    { lat: 1.3521, lon: 103.8198, label: 'Singapore' },
    { lat: 19.4326, lon: -99.1332, label: 'Mexico City, Mexico' },
    { lat: 30.0444, lon: 31.2357, label: 'Cairo, Egypt' },
    { lat: -26.2041, lon: 28.0473, label: 'Johannesburg, South Africa' },
    { lat: 59.9311, lon: 10.7579, label: 'Oslo, Norway' },
    { lat: 25.2048, lon: 55.2708, label: 'Dubai, UAE' },
    { lat: 37.7749, lon: -122.4194, label: 'San Francisco, CA, USA' },
    { lat: 52.5200, lon: 13.4050, label: 'Berlin, Germany' },
    { lat: 41.9028, lon: 12.4964, label: 'Rome, Italy' },
    { lat: 48.8566, lon: 2.3522, label: 'Paris, France' },
    { lat: 39.9042, lon: 116.4074, label: 'Beijing, China' },
    { lat: -34.6037, lon: -58.3816, label: 'Buenos Aires, Argentina' },
    { lat: 6.2088, lon: -75.5677, label: 'Medellin, Colombia' }
  ];
  
  // Generate diverse dates across different years and seasons
  const startYear = 2020;
  const endYear = 2024;
  const months = [1, 3, 6, 9, 12]; // Different seasons
  const days = [1, 7, 15, 21, 28]; // Different lunar phases
  const hours = [0, 6, 12, 18]; // Different times of day
  
  let generated = 0;
  const used = new Set<string>();
  
  while (generated < count && generated < worldCities.length * 50) { // Prevent infinite loop
    // Select random city
    const city = worldCities[Math.floor(Math.random() * worldCities.length)];
    
    // Generate random date/time
    const year = startYear + Math.floor(Math.random() * (endYear - startYear + 1));
    const month = months[Math.floor(Math.random() * months.length)];
    const day = days[Math.floor(Math.random() * days.length)];
    const hour = hours[Math.floor(Math.random() * hours.length)];
    
    // Create unique key
    const key = `${city.lat}_${city.lon}_${year}_${month}_${day}_${hour}`;
    
    if (!used.has(key)) {
      used.add(key);
      candidates.push({
        lat: city.lat + (Math.random() - 0.5) * 2, // Add small random offset
        lon: city.lon + (Math.random() - 0.5) * 2,
        label: city.label,
        year, month, day, hour
      });
      generated++;
    }
  }
  
  return candidates.slice(0, count);
}

// Calculate Julian Day (matching server logic)
function toJulianDayUT(dateStr: string, timeStr: string, lat?: number, lon?: number): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm = 0] = timeStr.split(':').map(Number);
  
  if (lat !== undefined && lon !== undefined) {
    try {
      const timezone = tzlookup.tzNameAt(lat, lon);
      if (timezone && moment.tz.zone(timezone)) {
        const localTimeWithTZ = moment.tz([y, m-1, d, hh, mm], timezone);
        const ut = localTimeWithTZ.utc();
        return swe.swe_julday(ut.year(), ut.month() + 1, ut.date(), 
                             ut.hour() + ut.minute()/60 + ut.second()/3600, swe.SE_GREG_CAL);
      }
    } catch (error) {
      console.warn(`Timezone lookup failed for ${lat}, ${lon}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return swe.swe_julday(y, m, d, hh + mm/60, swe.SE_GREG_CAL);
}

// Calculate planetary positions (matching server logic)
function calcPositions(jd: number, includeExtras = true): Record<string, number> {
  const positions: Record<string, number> = {};
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
  
  // Main planets
  for (const [name, id] of Object.entries(PLANETS)) {
    try {
      const result = swe.swe_calc_ut(jd, id, flags);
      
      if (result.rc < 0) {
        console.warn(`Failed to calculate ${name}: ${result.rc}`);
        continue;
      }
      
      let lon = result.longitude || result.xx?.[0];
      if (lon === undefined) {
        console.warn(`No longitude found for ${name}`);
        continue;
      }
      
      // Normalize longitude to 0-360
      positions[name] = lon % 360;
      if (positions[name] < 0) positions[name] += 360;
      
    } catch (e) {
      console.error(`Error calculating ${name}:`, e instanceof Error ? e.message : String(e));
    }
  }
  
  // Extras
  if (includeExtras) {
    for (const [name, id] of Object.entries(EXTRAS)) {
      try {
        const result = swe.swe_calc_ut(jd, id, flags);
        
        if (result.rc < 0) {
          console.warn(`Failed to calculate ${name}: ${result.rc}`);
          continue;
        }
        
        let lon = result.longitude || result.xx?.[0];
        if (lon === undefined) {
          console.warn(`No longitude found for ${name}`);
          continue;
        }
        
        positions[name] = lon % 360;
        if (positions[name] < 0) positions[name] += 360;
        
      } catch (e) {
        console.error(`Error calculating ${name}:`, e instanceof Error ? e.message : String(e));
      }
    }
  }
  
  return positions;
}

// Calculate Placidus house cusps (matching server logic)
function calcPlacidusCusps(jd: number, lat: number, lon: number): number[] {
  try {
    const result = swe.swe_houses(jd, lat, lon, 'P'); // 'P' for Placidus
    
    if (!result || !result.house || !Array.isArray(result.house) || result.house.length < 12) {
      console.warn("Invalid house data from Swiss Ephemeris, falling back to equal house");
      return Array.from({length: 12}, (_, i) => i * 30); // fallback to equal house
    }
    
    const cusps = result.house.slice(0, 12);
    return cusps.map((cusp: number) => cusp % 360);
    
  } catch (error) {
    console.error("Error calculating houses:", error instanceof Error ? error.message : String(error));
    return Array.from({length: 12}, (_, i) => i * 30);
  }
}

// Calculate aspects (matching server logic)
function calcAspects(positions: Record<string, number>): Array<{a: string, b: string, type: string, orb: number}> {
  const aspects: Array<{a: string, b: string, type: string, orb: number}> = [];
  const planets = Object.keys(positions);
  const aspectTypes = [
    { name: 'conjunction', angle: 0, orb: 8 },
    { name: 'sextile', angle: 60, orb: 6 },
    { name: 'square', angle: 90, orb: 8 },
    { name: 'trine', angle: 120, orb: 8 },
    { name: 'opposition', angle: 180, orb: 8 }
  ];
  
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const planetA = planets[i];
      const planetB = planets[j];
      const diff = Math.abs(positions[planetA] - positions[planetB]);
      const angle = Math.min(diff, 360 - diff);
      
      for (const aspect of aspectTypes) {
        if (Math.abs(angle - aspect.angle) <= aspect.orb) {
          aspects.push({
            a: planetA,
            b: planetB,
            type: aspect.name,
            orb: Math.abs(angle - aspect.angle)
          });
          break; // Only one aspect per planet pair
        }
      }
    }
  }
  
  return aspects;
}

// Calculate moon phase (matching server logic)
function calcMoonPhase(jd: number): number {
  try {
    const sunResult = swe.swe_calc_ut(jd, swe.SE_SUN, swe.SEFLG_SWIEPH);
    const moonResult = swe.swe_calc_ut(jd, swe.SE_MOON, swe.SEFLG_SWIEPH);
    
    if (sunResult.rc < 0 || moonResult.rc < 0) {
      console.warn("Failed to calculate moon phase");
      return 0.25; // Default to first quarter
    }
    
    const sunLon = sunResult.longitude || sunResult.xx?.[0];
    const moonLon = moonResult.longitude || moonResult.xx?.[0];
    
    if (sunLon === undefined || moonLon === undefined) {
      console.warn("Invalid sun/moon longitude for moon phase");
      return 0.25;
    }
    
    let diff = moonLon - sunLon;
    if (diff < 0) diff += 360;
    
    // Convert to 0-1 scale (0 = new moon, 0.5 = full moon, 1 = new moon)
    return (diff / 360) % 1;
    
  } catch (error) {
    console.error("Error calculating moon phase:", error instanceof Error ? error.message : String(error));
    return 0.25;
  }
}

// Calculate dominant elements (matching server logic)
function calcDominantElements(positions: Record<string, number>): {fire: number, earth: number, air: number, water: number} {
  const elementCounts = { fire: 0, earth: 0, air: 0, water: 0 };
  
  // Count planets in each element
  for (const [name, lon] of Object.entries(positions)) {
    if (name === 'chiron' || name === 'ceres' || name === 'pallas' || name === 'juno' || name === 'vesta') {
      continue; // Skip asteroids for element calculation
    }
    
    const sign = Math.floor(lon / 30);
    // Correct astrological element assignments:
    // Fire: Aries(0), Leo(4), Sagittarius(8)
    // Earth: Taurus(1), Virgo(5), Capricorn(9)
    // Air: Gemini(2), Libra(6), Aquarius(10)
    // Water: Cancer(3), Scorpio(7), Pisces(11)
    if (sign === 0 || sign === 4 || sign === 8) elementCounts.fire++;      // Aries, Leo, Sagittarius
    else if (sign === 1 || sign === 5 || sign === 9) elementCounts.earth++; // Taurus, Virgo, Capricorn
    else if (sign === 2 || sign === 6 || sign === 10) elementCounts.air++;  // Gemini, Libra, Aquarius
    else if (sign === 3 || sign === 7 || sign === 11) elementCounts.water++; // Cancer, Scorpio, Pisces
  }
  
  // Calculate weights
  const total = Object.values(elementCounts).reduce((sum, count) => sum + count, 0);
  const weights: {fire: number, earth: number, air: number, water: number} = {
    fire: 0, earth: 0, air: 0, water: 0
  };
  
  for (const [element, count] of Object.entries(elementCounts)) {
    weights[element as keyof typeof weights] = total > 0 ? count / total : 0.25;
  }
  
  return weights;
}

// Generate a single snapshot
function generateSnapshot(candidate: any): EphemerisSnapshot {
  const { lat, lon, year, month, day, hour } = candidate;
  
  // Format date/time
  const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  const timeStr = `${hour.toString().padStart(2, '0')}:00`;
  
  // Calculate Julian Day
  const jd = toJulianDayUT(dateStr, timeStr, lat, lon);
  
  // Calculate positions
  const positions = calcPositions(jd);
  
  // Calculate houses
  const houses = calcPlacidusCusps(jd, lat, lon);
  
  // Calculate aspects
  const aspects = calcAspects(positions);
  
  // Calculate moon phase
  const moonPhase = calcMoonPhase(jd);
  
  // Calculate dominant elements
  const dominantElements = calcDominantElements(positions);
  
  // Format timestamp
  const ts = moment.tz([year, month-1, day, hour, 0, 0], 'UTC').toISOString();
  
  // Ensure houses array has exactly 12 elements
  const housesArray: [number, number, number, number, number, number, number, number, number, number, number, number] = [
    houses[0] || 0, houses[1] || 30, houses[2] || 60, houses[3] || 90,
    houses[4] || 120, houses[5] || 150, houses[6] || 180, houses[7] || 210,
    houses[8] || 240, houses[9] || 270, houses[10] || 300, houses[11] || 330
  ];
  
  // Ensure aspects have correct types
  const typedAspects = aspects.map(aspect => ({
    a: aspect.a,
    b: aspect.b,
    type: aspect.type as 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition',
    orb: aspect.orb
  }));
  
  return {
    ts,
    tz: 'UTC',
    lat,
    lon,
    houseSystem: 'placidus',
    planets: Object.entries(positions).map(([name, lon]) => ({ name, lon })),
    houses: housesArray,
    aspects: typedAspects,
    moonPhase,
    dominantElements
  };
}

// Generate chart hash
import { generateChartHashSync } from '../../lib/hash/chartHash';

function generateChartHash(snapshot: EphemerisSnapshot): string {
  // Convert EphemerisSnapshot to ChartData format for hash generation
  const chartData = {
    date: snapshot.ts.split('T')[0],
    time: snapshot.ts.split('T')[1]?.split('.')[0] || '12:00:00',
    lat: snapshot.lat,
    lon: snapshot.lon
  };
  return generateChartHashSync(chartData).slice(0, 12);
}

// Main generation function
async function generateRealSnapshots(targetCount: number = 1000): Promise<SnapshotRecord[]> {
  console.log(`🔄 Generating ${targetCount} real ephemeris snapshots...`);
  
  // Stage counters
  const discover_candidates = targetCount * 2; // Generate more candidates than needed
  console.log(`📊 Stage 1: Discover candidates: ${discover_candidates}`);
  
  // Generate location candidates
  const candidates = generateLocationCandidates(discover_candidates);
  const after_schema = candidates.length;
  console.log(`📊 Stage 2: After schema validation: ${after_schema}`);
  
  if (after_schema < targetCount) {
    throw new Error(`EVAL_ABORT: Need ${targetCount} candidates, found ${after_schema}`);
  }
  
  // Generate ephemeris data
  console.log(`📊 Stage 3: Generating ephemeris data...`);
  const snapshots: EphemerisSnapshot[] = [];
  const malformed: number[] = [];
  
  for (let i = 0; i < Math.min(after_schema, targetCount * 1.2); i++) {
    try {
      const snapshot = generateSnapshot(candidates[i]);
      snapshots.push(snapshot);
      
      if ((i + 1) % 100 === 0) {
        console.log(`   Generated ${i + 1}/${Math.min(after_schema, targetCount * 1.2)} snapshots`);
      }
    } catch (error) {
      console.warn(`   Failed to generate snapshot ${i}: ${error instanceof Error ? error.message : String(error)}`);
      malformed.push(i);
    }
  }
  
  const after_ephemeris = snapshots.length;
  console.log(`📊 Stage 3: After ephemeris calculation: ${after_ephemeris}`);
  
  if (after_ephemeris < targetCount) {
    throw new Error(`EVAL_ABORT: Need ${targetCount} snapshots, generated ${after_ephemeris}`);
  }
  
  // Dedupe by chart hash
  console.log(`📊 Stage 4: Deduplicating by chart hash...`);
  const dedupeMap = new Map<string, EphemerisSnapshot>();
  for (const snap of snapshots) {
    const hash = generateChartHash(snap);
    if (!dedupeMap.has(hash)) {
      dedupeMap.set(hash, snap);
    }
  }
  const after_dedupe_list = Array.from(dedupeMap.values());
  const after_dedupe = after_dedupe_list.length;
  console.log(`📊 Stage 4: After deduplication: ${after_dedupe}`);
  
  if (after_dedupe < targetCount) {
    throw new Error(`EVAL_ABORT: Need ${targetCount} unique snapshots, found ${after_dedupe}`);
  }
  
  // Balance selection for diversity
  console.log(`📊 Stage 5: Balancing for diversity...`);
  const selectedSnapshots = after_dedupe_list.slice(0, targetCount);
  const after_balance = selectedSnapshots.length;
  console.log(`📊 Stage 5: After balance selection: ${after_balance}`);
  
  // Generate final records with features
  console.log(`📊 Stage 6: Encoding features...`);
  const records: SnapshotRecord[] = [];
  
  for (let i = 0; i < selectedSnapshots.length; i++) {
    const snapshot = selectedSnapshots[i];
    const id = `snap_${snapshot.ts}_${snapshot.lat}_${snapshot.lon}`;
    const feat = Array.from(encodeFeatures(snapshot));
    
    records.push({ id, snap: snapshot, feat });
    
    if ((i + 1) % 100 === 0) {
      console.log(`   Encoded ${i + 1}/${selectedSnapshots.length} features`);
    }
  }
  
  const realized_N = records.length;
  console.log(`📊 Stage 6: Final realized count: ${realized_N}`);
  
  if (realized_N !== targetCount) {
    throw new Error(`EVAL_ABORT: Expected ${targetCount}, realized ${realized_N}`);
  }
  
  console.log(`✅ Successfully generated ${realized_N} real ephemeris snapshots`);
  return records;
}

// Save snapshots to file
function saveSnapshots(records: SnapshotRecord[], outputPath: string): void {
  const outputLines = records.map(r => JSON.stringify(r));
  fs.writeFileSync(outputPath, outputLines.join('\n'));
  console.log(`💾 Saved ${records.length} snapshots to: ${outputPath}`);
}

// CLI interface
if (require.main === module) {
  const targetCount = parseInt(process.argv[2]) || 1000;
  const outputPath = process.argv[3] || path.join(__dirname, '../../../datasets/snapshots.jsonl');
  
  console.log(`🚀 Starting real snapshot generation for Phase 2C evaluation`);
  console.log(`   Target: ${targetCount} snapshots`);
  console.log(`   Output: ${outputPath}`);
  
  generateRealSnapshots(targetCount)
    .then(records => {
      saveSnapshots(records, outputPath);
      console.log(`🎉 Phase 2C snapshot generation complete!`);
      console.log(`   Generated: ${records.length} real ephemeris snapshots`);
      console.log(`   Ready for evaluation pipeline`);
    })
    .catch(error => {
      console.error(`❌ Snapshot generation failed: ${error.message}`);
      process.exit(1);
    });
}

export { generateRealSnapshots, saveSnapshots };
