/**
 * **Product:Phase-8** — **Verify:P8-Slice-03** compose orchestration verification (legacy script name).
 *
 * Scope:
 * - Verify ComposeAPI.compose() orchestration for single-chart sandbox mode only.
 * - Confirm response structure and ExplainSpec-based text wiring.
 * - Do NOT depend on provider/audio success.
 *
 * Out of scope:
 * - Campaign/RPG, identity/session, persistence, UI, providers.
 * - Overlay compose (can be added later behind an explicit gate).
 */

import { ComposeAPI } from '../api/compose';
import type { ComposeRequest } from '../explainer/contracts';
import type { EphemerisSnapshot } from '../contracts';

type CheckResult = { ok: boolean; message?: string };

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// Fixed deterministic snapshot fixture (same as Stages 1–2).
const SNAPSHOT_FIXTURE: EphemerisSnapshot = {
  ts: '2036-03-15T12:00:00Z',
  tz: 'UTC',
  lat: 40.7128,
  lon: -74.006,
  houseSystem: 'placidus',
  planets: [
    { name: 'sun', lon: 15 },
    { name: 'moon', lon: 195 },
    { name: 'mercury', lon: 30 },
    { name: 'venus', lon: 210 },
    { name: 'mars', lon: 90 },
    { name: 'jupiter', lon: 105 },
    { name: 'saturn', lon: 300 },
    { name: 'uranus', lon: 120 },
    { name: 'neptune', lon: 330 },
    { name: 'pluto', lon: 270 },
  ],
  houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
  aspects: [
    { bodyA: 'sun', bodyB: 'saturn', type: 'square', orb: 2 },
    { bodyA: 'moon', bodyB: 'uranus', type: 'conjunction', orb: 1.5 },
    { bodyA: 'venus', bodyB: 'neptune', type: 'trine', orb: 3 },
  ],
  moonPhase: 0.7,
  dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
};

async function verifySingleChartSandboxCompose(): Promise<CheckResult> {
  const api = new ComposeAPI();
  // Ensure we exercise current orchestration, not a stale cached response.
  (api as any).compositionCache?.clear?.();

  const request: ComposeRequest = {
    mode: 'sandbox',
    controls: {},
    // Use fixed snapshot fixture; compose should use this instead of chart-snapshot API.
    // This exercises orchestration wiring without any live ephemeris.
    overriddenSnapshot: deepClone(SNAPSHOT_FIXTURE) as any,
  } as any;

  const response = await api.compose(request);

  if (!response || typeof response !== 'object') {
    return { ok: false, message: 'Compose response is missing or not an object' };
  }

  const anyRes: any = response;

  // Text structure checks (plan-independent alignment: ExplainSpec-based template id and fields).
  const text = anyRes.text;
  if (!text || typeof text !== 'object') {
    return { ok: false, message: 'Compose response.text is missing' };
  }
  if (typeof text.short !== 'string' || !text.short.trim()) {
    return { ok: false, message: 'Compose text.short is missing or empty' };
  }
  if (typeof text.long !== 'string' || !text.long.trim()) {
    return { ok: false, message: 'Compose text.long is missing or empty' };
  }
  if (!Array.isArray(text.bullets)) {
    return { ok: false, message: 'Compose text.bullets is not an array' };
  }
  if (typeof text.template_id !== 'string' || !text.template_id.includes('explainspec')) {
    return { ok: false, message: 'Compose text.template_id does not indicate ExplainSpec path' };
  }

  // Fallback template must not be used for the fixed sandbox snapshot.
  if (text.template_id === 'explainspec-empty-v1') {
    return { ok: false, message: 'Compose used empty ExplainSpec fallback template for sandbox fixture' };
  }

  // Additional structural fields (not asserting full equality with earlier fixture slice; just presence/shape).
  if (typeof text.signatures !== 'string' || !text.signatures.trim()) {
    return { ok: false, message: 'Compose text.signatures is missing or empty' };
  }
  if (typeof text.significance !== 'string' || !text.significance.trim()) {
    return { ok: false, message: 'Compose text.significance is missing or empty' };
  }
  if (typeof text.musicalParagraph !== 'string') {
    return { ok: false, message: 'Compose text.musicalParagraph is not a string' };
  }
  if (!Array.isArray(text.musicalBullets)) {
    return { ok: false, message: 'Compose text.musicalBullets is not an array' };
  }

  // Audio/provider independence: ensure audio block exists structurally but do not require success.
  const audio = anyRes.audio;
  if (!audio || typeof audio !== 'object') {
    // Some modes may omit audio entirely (e.g., disabled exports); treat this as structural OK.
    // Verify:P8-Slice-03 is not blocking on audio success.
  } else {
    // Basic shape checks only; no success requirement.
    if (typeof audio.format !== 'string') {
      return { ok: false, message: 'Compose audio.format is missing or not a string' };
    }
    if (typeof audio.latency_ms !== 'number') {
      return { ok: false, message: 'Compose audio.latency_ms is missing or not a number' };
    }
  }

  return { ok: true };
}

async function main() {
  const results: { label: string; result: CheckResult }[] = [];

  results.push({
    label: 'Single-chart sandbox compose orchestration',
    result: await verifySingleChartSandboxCompose(),
  });

  console.log('Stage 3 Compose Orchestration Verification');
  let allOk = true;
  for (const { label, result } of results) {
    if (result.ok) {
      console.log(`✔ ${label}`);
    } else {
      allOk = false;
      console.log(`✖ ${label} FAILED${result.message ? ` — ${result.message}` : ''}`);
    }
  }

  if (allOk) {
    console.log('\nResult: PASS');
    process.exit(0);
  } else {
    console.log('\nResult: FAIL');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verify:P8-Slice-03 — Compose Orchestration Verification — unexpected error:', err);
  console.log('\nResult: FAIL');
  process.exit(1);
});

