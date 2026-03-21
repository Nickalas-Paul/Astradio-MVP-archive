/**
 * Pure relational weather smoke (no DB): run after `npm run vnext:build`.
 * Usage: node dist/vnext/vnext/scripts/stage7-weather-pure-smoke.js
 */

import type { EphemerisSnapshot } from '../contracts';
import { computeRelationalWeatherV1 } from '../relational/weather/compute-relational-weather-v1';

function minimalSnapshot(ts: string, lonOffset: number): EphemerisSnapshot {
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
  ].map((name, i) => ({ name, lon: (i * 30 + lonOffset) % 360 }));
  const houses = Array.from({ length: 12 }, (_, i) => (i * 30) as number) as EphemerisSnapshot['houses'];
  return {
    ts,
    tz: 'UTC',
    lat: 0,
    lon: 0,
    houseSystem: 'placidus',
    planets,
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

function main(): void {
  const transit = minimalSnapshot('2025-06-01T12:00:00Z', 5);
  const natalA = minimalSnapshot('1990-01-01T12:00:00Z', 0);
  const natalB = minimalSnapshot('1992-06-15T12:00:00Z', 10);
  const w1 = computeRelationalWeatherV1({
    connection: { kind: 'pair', bindingId: 'rel_test', chartIdsOrdered: ['a', 'b'] },
    transit,
    memberSnapshotsOrdered: [natalA, natalB],
    vectorHashes: { a: 'hash_a', b: 'hash_b' },
  });
  const w2 = computeRelationalWeatherV1({
    connection: { kind: 'pair', bindingId: 'rel_test', chartIdsOrdered: ['a', 'b'] },
    transit,
    memberSnapshotsOrdered: [natalA, natalB],
    vectorHashes: { a: 'hash_a', b: 'hash_b' },
  });
  if (w1.stateHash !== w2.stateHash) {
    console.error('FAIL: determinism stateHash');
    process.exit(1);
  }
  const transit2 = minimalSnapshot('2025-06-01T18:00:00Z', 5);
  const w3 = computeRelationalWeatherV1({
    connection: { kind: 'pair', bindingId: 'rel_test', chartIdsOrdered: ['a', 'b'] },
    transit: transit2,
    memberSnapshotsOrdered: [natalA, natalB],
    vectorHashes: { a: 'hash_a', b: 'hash_b' },
  });
  if (w3.stateHash === w1.stateHash) {
    console.warn('WARN: transit change did not change stateHash (possible if snapshots identical)');
  }
  console.log('OK stage7 pure smoke', w1.stateHash.slice(0, 12), w1.score);
}

main();
