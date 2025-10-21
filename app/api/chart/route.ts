import { NextRequest, NextResponse } from 'next/server';
import { getChartData } from '../../../services/ephemeris';

function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || '2000-01-01';
  const time = searchParams.get('time') || '00:00';
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lon = parseFloat(searchParams.get('lon') || '0');
  const seedParam = searchParams.get('seed') || `${date}-${time}-${lat.toFixed(2)}-${lon.toFixed(2)}`;

  // Deterministic pseudo chart data from seed
  let seed = 0;
  for (let i = 0; i < seedParam.length; i++) seed = (seed * 31 + seedParam.charCodeAt(i)) >>> 0;
  const rand = mulberry32(seed);

  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','node'];
  const positions: Record<string, number> = {};
  planets.forEach((p) => { positions[p] = Math.floor(rand() * 36000) / 100; });

  const cusps = Array.from({ length: 12 }, () => Math.floor(rand() * 36000) / 100);

  const aspects = [] as any[];
  const chart = {
    positions,
    cusps,
    aspects,
    moonPhase: Math.floor(rand() * 100) / 100,
    dominantElements: {
      fire: Math.floor(rand() * 100) / 100,
      earth: Math.floor(rand() * 100) / 100,
      air: Math.floor(rand() * 100) / 100,
      water: Math.floor(rand() * 100) / 100,
    },
  };
  // Use Swiss Ephemeris service for real chart data
  const chartData = {
    date,
    time,
    lat,
    lon
  };
  
  const ephemerisResult = await getChartData(chartData);
  return NextResponse.json({ ...ephemerisResult, seed: seedParam }, { status: 200 });
}


