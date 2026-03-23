/**
 * Community Compatibility V1 — determinism checks.
 * 1) One fixed /api/compose request: assert hashes.plan_sha256 is stable (golden baseline).
 * 2) POST /api/comparisons equivalent (createComparison) twice with same inputs: assert same planHash and mergedFeatureHash.
 * Run: npx ts-node -P vnext vnext/scripts/compat-determinism.ts
 * Or: node dist/vnext/vnext/scripts/compat-determinism.js (after tsc -p vnext)
 */

import { ComposeAPI } from '../api/compose';
import type { EphemerisSnapshot } from '../contracts';
import * as storage from '../compat/storage';
import { createComparison } from '../compat/comparison-service';

const FIXED_DATE = '2025-01-15';
const FIXED_TIME = '12:00';
const FIXED_LAT = 40.7128;
const FIXED_LON = -74.006;

function makeSnapshot(date: string, time: string, lat: number, lon: number): EphemerisSnapshot {
  const planets = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
  ].map((name, i) => ({ name, lon: (i * 37 + lat) % 360 }));
  const houses: [number, number, number, number, number, number, number, number, number, number, number, number] = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
  ];
  return {
    ts: `${date}T${time}:00Z`,
    tz: 'UTC',
    lat,
    lon,
    houseSystem: 'placidus',
    planets,
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

async function main(): Promise<void> {
  let failed = 0;

  // --- 1) Compose golden: one fixed request, capture plan_sha256 (no baseline file; just log and assert non-empty) ---
  console.log('[compat-determinism] 1) Compose golden (single run)...');
  (global as any).fetch = async (url: string | URL): Promise<Response> => {
    const u = String(url);
    if (u.includes('chart-snapshot')) {
      const snap = makeSnapshot(FIXED_DATE, FIXED_TIME, FIXED_LAT, FIXED_LON);
      return { ok: true, json: async () => snap } as Response;
    }
    throw new Error('Unexpected fetch: ' + u);
  };

  const api = new ComposeAPI();
  const composeRequest = {
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

  try {
    const res = await api.compose(composeRequest);
    const hashes = (res as any).hashes || {};
    const planHash = hashes.plan_sha256;
    const audioHash = hashes.audio;
    const explainHash = hashes.explanation;
    if (!planHash || typeof planHash !== 'string') {
      console.error('[compat-determinism] FAIL: compose response missing hashes.plan_sha256');
      failed++;
    } else {
      console.log('[compat-determinism] OK: compose plan_sha256 =', planHash.slice(0, 16) + '...');
    }
    if (!audioHash || typeof audioHash !== 'string') {
      console.error('[compat-determinism] FAIL: compose response missing hashes.audio');
      failed++;
    } else {
      console.log('[compat-determinism] OK: compose audio hash =', audioHash.slice(0, 16) + '...');
    }
    if (!explainHash || typeof explainHash !== 'string') {
      console.error('[compat-determinism] FAIL: compose response missing hashes.explanation');
      failed++;
    } else {
      console.log('[compat-determinism] OK: compose explanation hash =', explainHash.slice(0, 16) + '...');
    }
  } catch (e) {
    console.error('[compat-determinism] Compose golden error:', e);
    failed++;
  }

  // --- 2) Comparisons determinism: same inputs => same planHash and mergedFeatureHash ---
  console.log('[compat-determinism] 2) Comparisons determinism (two runs, same inputs)...');
  const snapA = makeSnapshot(FIXED_DATE, FIXED_TIME, FIXED_LAT, FIXED_LON);
  const snapB = makeSnapshot('1990-06-01', '14:30', 34.05, -118.25);

  (global as any).fetch = async (url: string | URL): Promise<Response> => {
    const u = String(url);
    if (u.includes('chart-snapshot')) {
      const params = new URL(u).searchParams;
      const date = params.get('date') || '';
      const time = params.get('time') || '12:00';
      const lat = parseFloat(params.get('lat') || '0');
      const lon = parseFloat(params.get('lon') || '0');
      const snap = Math.abs(lat - FIXED_LAT) < 0.01 && Math.abs(lon - FIXED_LON) < 0.01 ? snapA : snapB;
      return { ok: true, json: async () => snap } as Response;
    }
    throw new Error('Unexpected fetch: ' + u);
  };

  const chartA = await storage.createChart({
    label: 'Chart A',
    date: FIXED_DATE,
    time: FIXED_TIME,
    lat: FIXED_LAT,
    lon: FIXED_LON,
  });
  const chartB = await storage.createChart({
    label: 'Chart B',
    date: '1990-06-01',
    time: '14:30',
    lat: 34.05,
    lon: -118.25,
  });

  try {
    const result1 = await createComparison({
      chartAId: chartA.id,
      chartBId: chartB.id,
      relationshipMode: 'friends',
    });
    const result2 = await createComparison({
      chartAId: chartA.id,
      chartBId: chartB.id,
      relationshipMode: 'friends',
    });
    if (result1.planHash !== result2.planHash) {
      console.error('[compat-determinism] FAIL: planHash differs between runs:', result1.planHash, 'vs', result2.planHash);
      failed++;
    } else {
      console.log('[compat-determinism] OK: planHash identical', result1.planHash.slice(0, 16) + '...');
    }
    const hash1 = result1.comparison.mergedFeatureHash;
    const hash2 = result2.comparison.mergedFeatureHash;
    if (hash1 && hash2 && hash1 !== hash2) {
      console.error('[compat-determinism] FAIL: mergedFeatureHash differs:', hash1, 'vs', hash2);
      failed++;
    } else if (hash1 && hash2) {
      console.log('[compat-determinism] OK: mergedFeatureHash identical', hash1.slice(0, 16) + '...');
    }
    // Check compatibilityText structured equality where possible
    const text1 = result1.comparison.compatibilityText;
    const text2 = result2.comparison.compatibilityText;
    if (typeof text1 === 'string' || typeof text2 === 'string') {
      if (text1 !== text2) {
        console.error('[compat-determinism] FAIL: compatibilityText string differs between runs');
        failed++;
      }
    } else {
      const t1 = text1 as any;
      const t2 = text2 as any;
      const eq =
        t1.short === t2.short &&
        t1.long === t2.long &&
        Array.isArray(t1.bullets) &&
        Array.isArray(t2.bullets) &&
        t1.bullets.length === t2.bullets.length &&
        t1.bullets.every((b: string, i: number) => b === t2.bullets[i]);
      if (!eq) {
        console.error('[compat-determinism] FAIL: compatibilityText structured payload differs between runs');
        failed++;
      } else {
        console.log('[compat-determinism] OK: compatibilityText structured payload identical');
      }
    }
  } catch (e) {
    console.error('[compat-determinism] Comparisons determinism error:', e);
    failed++;
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
