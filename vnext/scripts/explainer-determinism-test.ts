/**
 * T1: Determinism test for explainer.
 * Runs compose twice with identical request; asserts explainer short/long/bullets identical.
 * No time-based drift allowed. In-process with mocked chart-snapshot.
 */

import { ComposeAPI } from '../api/compose';
import type { EphemerisSnapshot } from '../contracts';

const FIXED_DATE = '2025-01-15';
const FIXED_TIME = '12:00';
const FIXED_LAT = 40.7128;
const FIXED_LON = -74.006;

function makeFixedSnapshot(): EphemerisSnapshot {
  const planets = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
  ].map((name, i) => ({ name, lon: (i * 37) % 360 }));
  const houses: [number, number, number, number, number, number, number, number, number, number, number, number] = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330
  ];
  return {
    ts: `${FIXED_DATE}T${FIXED_TIME}:00Z`,
    tz: 'UTC',
    lat: FIXED_LAT,
    lon: FIXED_LON,
    houseSystem: 'placidus',
    planets,
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 }
  };
}

async function main(): Promise<void> {
  const fixedSnapshot = makeFixedSnapshot();
  (global as any).fetch = async (url: string | URL): Promise<Response> => {
    const u = String(url);
    if (u.includes('chart-snapshot')) {
      return { ok: true, json: async () => fixedSnapshot } as Response;
    }
    throw new Error('Unexpected fetch: ' + u);
  };

  const api = new ComposeAPI();
  const baseRequest = {
    mode: 'sky' as const,
    skyParams: {
      latitude: FIXED_LAT,
      longitude: FIXED_LON,
      datetime: `${FIXED_DATE}T${FIXED_TIME}:00`
    }
  };
  const request1 = { ...baseRequest, _run: 1 };
  const request2 = { ...baseRequest, _run: 2 };

  const res1 = await api.compose(request1) as any;
  const res2 = await api.compose(request2) as any;

  const expl1 = res1?.explanation;
  const expl2 = res2?.explanation;
  if (!expl1?.sections || !expl2?.sections) {
    console.error('FAIL: missing explanation.sections in response');
    process.exit(1);
  }

  const short1 = expl1.sections.find((s: { title: string }) => s.title === 'Theme')?.text ?? '';
  const short2 = expl2.sections.find((s: { title: string }) => s.title === 'Theme')?.text ?? '';
  const long1 = expl1.sections.find((s: { title: string }) => s.title === 'Details')?.text ?? '';
  const long2 = expl2.sections.find((s: { title: string }) => s.title === 'Details')?.text ?? '';
  const bullets1 = expl1.sections.find((s: { title: string }) => s.title === 'Bullets')?.text ?? '';
  const bullets2 = expl2.sections.find((s: { title: string }) => s.title === 'Bullets')?.text ?? '';

  const shortOk = short1 === short2;
  const longOk = long1 === long2;
  const bulletsOk = bullets1 === bullets2;

  if (!shortOk || !longOk || !bulletsOk) {
    console.error('FAIL: explainer output differed between runs');
    if (!shortOk) console.error('  short mismatch:', { a: short1?.slice(0, 80), b: short2?.slice(0, 80) });
    if (!longOk) console.error('  long mismatch:', { a: long1?.slice(0, 80), b: long2?.slice(0, 80) });
    if (!bulletsOk) console.error('  bullets mismatch:', { a: bullets1?.slice(0, 80), b: bullets2?.slice(0, 80) });
    process.exit(1);
  }

  console.log('OK: explainer short/long/bullets identical across two runs');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
