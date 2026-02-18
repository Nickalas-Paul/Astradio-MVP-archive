/**
 * Phase 1 Determinism Verification
 * 
 * Verifies that compose determinism is preserved after architecture engine refactor.
 * Uses fixed chart inputs from existing determinism scripts.
 */

import { ComposeAPI } from '../api/compose';
import type { EphemerisSnapshot } from '../contracts';

const TEST_CASES = [
  {
    name: 'Fixed Sandbox (compose-determinism-soak)',
    request: {
      mode: 'sandbox' as const,
      chartData: { date: '2025-01-15', time: '12:00', lat: 40.7128, lon: -74.006 },
      controls: {
        arc_shape: 0.45,
        density_level: 0.6,
        tempo_norm: 0.7,
        step_bias: 0.7,
        leap_cap: 5,
        rhythm_template_id: 3,
        syncopation_bias: 0.3,
        motif_rate: 0.6,
        element_dominance: 'air',
        aspect_tension: 0.5,
        modality: 'mutable' as const,
      },
    },
    snapshot: {
      ts: '2025-01-15T12:00:00Z',
      tz: 'UTC',
      lat: 40.7128,
      lon: -74.006,
      houseSystem: 'placidus',
      planets: ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(
        (name, i) => ({ name, lon: (i * 37) % 360 })
      ),
      houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as [number, number, number, number, number, number, number, number, number, number, number, number],
      aspects: [],
      moonPhase: 0.5,
      dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
    } as EphemerisSnapshot,
  },
  {
    name: 'Provenance Test Case 1',
    request: {
      mode: 'sandbox' as const,
      chartData: { date: '2025-01-15', time: '12:00', lat: 40.7128, lon: -74.006 },
      controls: {},
    },
    snapshot: {
      ts: '2025-01-15T12:00:00Z',
      tz: 'UTC',
      lat: 40.7128,
      lon: -74.006,
      houseSystem: 'placidus',
      planets: ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(
        (name, i) => {
          const seed = '2025-01-15T12:00:00Z' + 40.7128 + -74.006;
          let h = 0;
          for (let j = 0; j < seed.length; j++) h = (h * 31 + seed.charCodeAt(j)) >>> 0;
          return { name, lon: ((h + i * 37) * 17) % 360 };
        }
      ),
      houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as [number, number, number, number, number, number, number, number, number, number, number, number],
      aspects: [],
      moonPhase: 0.5,
      dominantElements: { fire: 0.2 + (123 % 11) / 40, earth: 0.2 + ((123 >> 4) % 11) / 40, air: 0.2 + ((123 >> 8) % 11) / 40, water: Math.max(0, 1 - 0.2 - 0.2 - 0.2) },
    } as EphemerisSnapshot,
  },
];

function mockFetch(snapshot: EphemerisSnapshot) {
  (global as any).fetch = async (url: string | URL): Promise<Response> => {
    const u = String(url);
    if (u.includes('chart-snapshot')) {
      return { ok: true, json: async () => snapshot } as Response;
    }
    throw new Error('Unexpected fetch: ' + u);
  };
}

async function runDeterminismTest(testCase: typeof TEST_CASES[0], runs: number = 3): Promise<{
  planHashes: string[];
  audioHashes: string[];
  allIdentical: boolean;
}> {
  process.env.ENABLE_WAV_EXPORT = '1';
  mockFetch(testCase.snapshot);

  const api = new ComposeAPI();
  const planHashes: string[] = [];
  const audioHashes: string[] = [];

  for (let i = 0; i < runs; i++) {
    const res = await api.compose(testCase.request as any);
    const hashes = (res as any).hashes;
    if (hashes?.plan_sha256) planHashes.push(hashes.plan_sha256);
    if ((res as any).audio?.sha256) audioHashes.push((res as any).audio.sha256);
  }

  const planIdentical = planHashes.length > 0 && planHashes.every(h => h === planHashes[0]);
  const audioIdentical = audioHashes.length > 0 && audioHashes.every(h => h === audioHashes[0]);
  const allIdentical = planIdentical && audioIdentical;

  return { planHashes, audioHashes, allIdentical };
}

async function main(): Promise<void> {
  console.log('[phase1-determinism] Running determinism verification...\n');

  const results: Array<{
    name: string;
    planHashes: string[];
    audioHashes: string[];
    allIdentical: boolean;
    planHash: string;
    audioHash: string;
  }> = [];

  for (const testCase of TEST_CASES) {
    try {
      const result = await runDeterminismTest(testCase, 3);
      results.push({
        name: testCase.name,
        ...result,
        planHash: result.planHashes[0] || 'N/A',
        audioHash: result.audioHashes[0] || 'N/A',
      });
    } catch (e: any) {
      if (e?.code === 'ML_INFERENCE_UNAVAILABLE' || e?.message?.includes('ML')) {
        if (process.env.ALLOW_ML_SKIP === '1') {
          console.log(`SKIP: ${testCase.name} - ML not available (ALLOW_ML_SKIP=1)`);
          continue;
        }
        console.error(`FAIL: ${testCase.name} - ML not available`);
        process.exit(1);
      }
      console.error(`FAIL: ${testCase.name}`, e);
      process.exit(1);
    }
  }

  // Print results table
  console.log('Determinism Verification Results:\n');
  console.log('| Test Case | plan_sha256 | audio.sha256 | Status |');
  console.log('|-----------|-------------|--------------|--------|');
  
  let allPassed = true;
  for (const result of results) {
    const status = result.allIdentical ? '✅ PASS' : '❌ FAIL';
    if (!result.allIdentical) allPassed = false;
    console.log(`| ${result.name} | ${result.planHash.slice(0, 16)}... | ${result.audioHash.slice(0, 16)}... | ${status} |`);
  }

  console.log('\n');
  if (allPassed) {
    console.log('✅ All determinism tests passed');
  } else {
    console.log('❌ Some determinism tests failed');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
