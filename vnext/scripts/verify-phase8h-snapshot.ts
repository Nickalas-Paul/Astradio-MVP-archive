/**
 * Phase 8H verification: chart-snapshot returns 15 bodies and aspect metadata.
 * Run with server up: npx ts-node --project ../../tsconfig.json vnext/scripts/verify-phase8h-snapshot.ts
 * Or: node dist/... after build.
 */

const BASE = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:4000';

const EXPECTED_BODIES = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
  'chiron', 'ceres', 'pallas', 'juno', 'vesta',
];

async function runPhase8HVerify(): Promise<void> {
  const url = `${BASE}/api/chart-snapshot?date=2025-01-15&time=12:00&lat=40.71&lon=-74`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('FAIL: chart-snapshot returned', res.status, await res.text());
    process.exit(1);
  }
  const snapshot = await res.json();
  const planets = snapshot.planets || [];
  const bodies = planets.map((p: { name: string }) => p.name.toLowerCase());
  const missing = EXPECTED_BODIES.filter((b) => !bodies.includes(b));
  if (missing.length > 0) {
    console.error('FAIL: missing bodies in snapshot:', missing.join(', '));
    console.error('Got:', bodies.join(', '));
    process.exit(1);
  }
  const aspects = snapshot.aspects || [];
  const withMeta = aspects.filter((a: { dynamics?: string }) => a.dynamics != null);
  console.log('OK: bodies=', planets.length, 'aspects=', aspects.length, 'aspectsWithMetadata=', withMeta.length);
  if (aspects.length > 0 && withMeta.length === 0) {
    console.warn('WARN: aspects present but no dynamics/strength/exactness/priorityBase');
  }
  if (aspects.length > 0 && withMeta.length > 0) {
    console.log('Sample aspect:', JSON.stringify(aspects[0], null, 2));
  }
  console.log('Phase 8H snapshot verification passed.');
}

runPhase8HVerify().catch((e) => {
  console.error(e);
  process.exit(1);
});
