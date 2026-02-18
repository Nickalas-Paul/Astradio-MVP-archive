/**
 * Soak-ready determinism test: run compose N times with a fully fixed request.
 * Asserts audio.sha256 identical, gate_report.calibrated.overall true, audio shape.
 * In-process with mocked chart-snapshot. Deterministic; no randomness.
 */

import { ComposeAPI } from '../api/compose';
import type { EphemerisSnapshot } from '../contracts';

const DEFAULT_RUNS = 20;
const DELAY_MS = 250;
const FIXED_DATE = '2025-01-15';
const FIXED_TIME = '12:00';
const FIXED_LAT = 40.7128;
const FIXED_LON = -74.006;

function makeFixedSnapshot(): EphemerisSnapshot {
  const planets = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
  ].map((name, i) => ({ name, lon: (i * 37) % 360 }));
  const houses: [number, number, number, number, number, number, number, number, number, number, number, number] = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
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
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  process.env.ENABLE_WAV_EXPORT = '1';
  const n = Math.max(1, parseInt(process.env.COMPOSE_SOAK_RUNS || String(DEFAULT_RUNS), 10) || DEFAULT_RUNS);
  const fixedSnapshot = makeFixedSnapshot();

  (global as any).fetch = async (url: string | URL): Promise<Response> => {
    const u = String(url);
    if (u.includes('chart-snapshot')) {
      return { ok: true, json: async () => fixedSnapshot } as Response;
    }
    throw new Error('Unexpected fetch: ' + u);
  };

  const api = new ComposeAPI();
  const request = {
    mode: 'sandbox' as const,
    chartData: { date: FIXED_DATE, time: FIXED_TIME, lat: FIXED_LAT, lon: FIXED_LON },
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
  };

  const latencies: number[] = [];
  let firstSha256: string | null = null;
  let passes = 0;

  for (let i = 0; i < n; i++) {
    const start = Date.now();
    const res = await api.compose(request);
    const elapsed = Date.now() - start;
    latencies.push(elapsed);

    const audio = (res as any).audio;
    if (!audio || typeof audio !== 'object') {
      console.error(`FAIL run ${i + 1}: missing audio`);
      process.exit(1);
    }
    if (audio.format === undefined || audio.base64 === undefined || audio.sha256 === undefined) {
      console.error(`FAIL run ${i + 1}: audio missing format/base64/sha256`);
      process.exit(1);
    }
    const sha = audio.sha256 as string;
    if (firstSha256 === null) firstSha256 = sha;
    else if (sha !== firstSha256) {
      console.error(`FAIL run ${i + 1}: sha256 changed (expected ${firstSha256}, got ${sha})`);
      process.exit(1);
    }

    const gateReport = (res as any).gate_report;
    const overallPass = gateReport?.calibrated?.overall === true;
    if (overallPass) passes++;
    if (!overallPass) {
      console.error(`FAIL run ${i + 1}: gate_report.calibrated.overall not true`);
      process.exit(1);
    }

    if (i < n - 1) await sleep(DELAY_MS);
  }

  const minMs = Math.min(...latencies);
  const maxMs = Math.max(...latencies);
  const avgMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  console.log(
    `OK: compose determinism soak | count=${n} sha256=${firstSha256?.slice(0, 16)}... minMs=${minMs.toFixed(0)} avgMs=${avgMs.toFixed(0)} maxMs=${maxMs.toFixed(0)} passes=${passes}/${n}`
  );
}

main().catch((e) => {
  if (e?.code === 'ML_INFERENCE_UNAVAILABLE' || e?.message?.includes('ML')) {
    if (process.env.ALLOW_ML_SKIP === '1') {
      console.log('SKIP: ML not available (ALLOW_ML_SKIP=1)');
      process.exit(0);
    }
    console.error('FAIL: ML not available; set ALLOW_ML_SKIP=1 to skip');
    process.exit(1);
  }
  console.error(e);
  process.exit(1);
});
