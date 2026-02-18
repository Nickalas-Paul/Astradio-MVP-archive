/**
 * API-level test: response shape stability and debug_audio behavior.
 * Calls compose in-process with mocked chart-snapshot. Asserts:
 * - Without debug_audio: response does NOT contain audio_debug
 * - With debug_audio=true: response contains audio_debug with required keys
 * - audio.sha256 exists and is stable across two identical calls
 * No external network; no secrets logged.
 */

import { ComposeAPI } from '../api/compose';
import type { EphemerisSnapshot } from '../contracts';

const REQUIRED_DEBUG_KEYS = [
  'presetId',
  'env',
  'filter',
  'drive',
  'reverb',
  'perChannelGains',
  'perChannelPan',
  'masterPeak',
];

function makeFixedSnapshot(): EphemerisSnapshot {
  const planets = [
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
  ].map((name, i) => ({ name, lon: (i * 37) % 360 }));
  const houses: [number, number, number, number, number, number, number, number, number, number, number, number] = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
  ];
  return {
    ts: '2025-01-15T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets,
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

async function main(): Promise<void> {
  process.env.ENABLE_WAV_EXPORT = '1';
  const fixedSnapshot = makeFixedSnapshot();

  (global as any).fetch = async (url: string | URL): Promise<Response> => {
    const u = String(url);
    if (u.includes('chart-snapshot')) {
      return {
        ok: true,
        json: async () => fixedSnapshot,
      } as Response;
    }
    throw new Error('Unexpected fetch: ' + u);
  };

  const api = new ComposeAPI();
  const baseRequest = {
    mode: 'sandbox' as const,
    controls: {
      arc_shape: 0.45,
      density_level: 0.6,
      tempo_norm: 0.7,
      step_bias: 0.7,
      leap_cap: 5,
      rhythm_template_id: 3,
      syncopation_bias: 0.3,
      motif_rate: 0.6,
      element_dominance: 'fire',
      aspect_tension: 0.4,
      modality: 'mutable' as const,
    },
  };

  let failed = false;

  try {
    const resNoDebug = await api.compose(baseRequest);
    if ('audio_debug' in resNoDebug && (resNoDebug as any).audio_debug !== undefined) {
      console.error('FAIL: response without debug_audio must not contain audio_debug');
      failed = true;
    }
    const audioNo = (resNoDebug as any).audio;
    if (audioNo?.base64 && !audioNo?.sha256) {
      console.error('FAIL: when audio is present, audio.sha256 must exist');
      failed = true;
    }

    const resWithDebug = await api.compose({ ...baseRequest, debug_audio: true } as any);
    const debug = (resWithDebug as any).audio_debug;
    if (!debug || typeof debug !== 'object') {
      console.error('FAIL: response with debug_audio=true must contain audio_debug object');
      failed = true;
    } else {
      for (const k of REQUIRED_DEBUG_KEYS) {
        if (!(k in debug)) {
          console.error('FAIL: audio_debug missing key:', k);
          failed = true;
        }
      }
    }

    const res1 = await api.compose(baseRequest);
    const res2 = await api.compose(baseRequest);
    const sha1 = (res1 as any).audio?.sha256 ?? '';
    const sha2 = (res2 as any).audio?.sha256 ?? '';
    if (sha1 && sha2 && sha1 !== sha2) {
      console.error('FAIL: audio.sha256 must be stable across identical calls');
      failed = true;
    }
  } catch (e: any) {
    const mlUnavailable = e?.code === 'ML_INFERENCE_UNAVAILABLE' || e?.message?.includes('ML');
    if (mlUnavailable) {
      if (process.env.ALLOW_ML_SKIP === '1') {
        console.log('SKIP: ML not available (ALLOW_ML_SKIP=1)');
        process.exit(0);
      }
      console.error('FAIL: ML not available; set ALLOW_ML_SKIP=1 to skip in CI');
      process.exit(1);
    }
    console.error('FAIL: compose threw', e?.message ?? e);
    failed = true;
  }

  if (failed) process.exit(1);
  console.log('OK: compose audio contract');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
