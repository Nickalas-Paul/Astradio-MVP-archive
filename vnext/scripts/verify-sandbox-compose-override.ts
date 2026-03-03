/**
 * Phase 6: Verify sandbox compose path with overriddenSnapshot.
 * Ensures compose uses generateArchitectureFromSnapshot when overriddenSnapshot is provided.
 * Run after vnext build: node dist/vnext/scripts/verify-sandbox-compose-override.js
 */

import { ComposeAPI } from '../api/compose';
import type { EphemerisSnapshot } from '../contracts';

function makeValidSnapshot(): EphemerisSnapshot {
  const planets = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
  ].map((name, i) => ({ name, lon: (i * 37) % 360 }));
  const houses: EphemerisSnapshot['houses'] = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
  ];
  return {
    ts: '1979-08-16T12:00:00Z',
    tz: 'UTC',
    lat: 38.5816,
    lon: -121.4944,
    houseSystem: 'placidus',
    planets,
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

async function main(): Promise<void> {
  (global as any).fetch = async (): Promise<Response> => {
    return { ok: false } as Response;
  };

  const api = new ComposeAPI();

  // 1) Invalid overriddenSnapshot must throw (fail closed)
  try {
    await api.compose({
      mode: 'sandbox',
      controls: {},
      overriddenSnapshot: { invalid: true },
    } as any);
    console.error('FAIL: expected compose to throw for invalid overriddenSnapshot');
    process.exit(1);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('Invalid overriddenSnapshot')) {
      console.error('FAIL: expected "Invalid overriddenSnapshot" error, got:', msg);
      process.exit(1);
    }
  }

  // 2) Valid overriddenSnapshot must produce plan_sha256
  const snapshot = makeValidSnapshot();
  const res = await api.compose({
    mode: 'sandbox',
    controls: { arc_shape: 0.5, density_level: 0.6 },
    seed: 'phase6-verify-override',
    overriddenSnapshot: snapshot,
  } as any);

  const planSha = (res as any).hashes?.plan_sha256;
  if (!planSha || typeof planSha !== 'string') {
    console.error('FAIL: missing or invalid hashes.plan_sha256 when using overriddenSnapshot');
    process.exit(1);
  }

  console.log('OK: sandbox compose override path — invalid rejected, valid returns plan_sha256');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
