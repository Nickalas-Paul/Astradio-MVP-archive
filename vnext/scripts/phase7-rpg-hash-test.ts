/**
 * Phase 7 Slice 1 — RPG hashing and canonicalization tests.
 *
 * This script asserts:
 * - Canonical JSON hashing is stable under key reordering.
 * - Arrays remain intentionally ordered (reordering changes the hash).
 * - EphemerisSnapshot hashing is stable under key reordering.
 * - Seed formulas (turn/audio) are stable and match golden values.
 */

import { hashCanonicalJson, canonicalJsonString, sha256Hex } from '../rpg/hash/json-hash';
import { hashSnapshot } from '../rpg/hash/snapshot-hash';
import { makeTurnSeed, makeAudioSeed } from '../rpg/hash/seeds';
import type { EphemerisSnapshot } from '../contracts';
import type { TransitHash, StateHash, RpgAlgoVersion, AudioAlgoVersion } from '../rpg/contracts';

function assertEqual(actual: string, expected: string, message: string, failedRef: { value: boolean }): void {
  if (actual !== expected) {
    // eslint-disable-next-line no-console
    console.error(`FAIL: ${message}`);
    // eslint-disable-next-line no-console
    console.error(`  expected: ${expected}`);
    // eslint-disable-next-line no-console
    console.error(`  actual:   ${actual}`);
    failedRef.value = true;
  } else {
    // eslint-disable-next-line no-console
    console.log(`✓ ${message}`);
  }
}

function runJsonHashTests(failedRef: { value: boolean }): void {
  const obj1 = {
    a: 1,
    b: {
      c: 2,
      d: [1, 2, 3],
    },
  };

  const obj2 = {
    b: {
      d: [1, 2, 3],
      c: 2,
    },
    a: 1,
  };

  const h1 = hashCanonicalJson(obj1);
  const h2 = hashCanonicalJson(obj2);

  assertEqual(h1, h2, 'Canonical JSON hash ignores object key ordering', failedRef);

  const obj3 = {
    a: [1, 2, 3],
  };
  const obj4 = {
    a: [3, 2, 1],
  };

  const h3 = hashCanonicalJson(obj3);
  const h4 = hashCanonicalJson(obj4);

  if (h3 === h4) {
    // eslint-disable-next-line no-console
    console.error('FAIL: Array reordering should change canonical JSON hash');
    failedRef.value = true;
  } else {
    // eslint-disable-next-line no-console
    console.log('✓ Array ordering is significant in canonical JSON hash');
  }

  const canon1 = canonicalJsonString(obj1);
  const canon2 = canonicalJsonString(obj2);
  assertEqual(canon1, canon2, 'Canonical JSON string is stable under key reordering', failedRef);
}

function makeSampleSnapshot(): EphemerisSnapshot {
  return {
    ts: '2026-03-03T00:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 10 },
      { name: 'Moon', lon: 20 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [
      { a: 'Sun', b: 'Moon', type: 'trine', orb: 2 },
    ],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function runSnapshotHashTests(failedRef: { value: boolean }): void {
  const s1 = makeSampleSnapshot();
  const s2: EphemerisSnapshot = {
    houseSystem: s1.houseSystem,
    lat: s1.lat,
    lon: s1.lon,
    ts: s1.ts,
    tz: s1.tz,
    planets: s1.planets,
    houses: s1.houses,
    aspects: s1.aspects,
    moonPhase: s1.moonPhase,
    dominantElements: s1.dominantElements,
  };

  const h1 = hashSnapshot(s1);
  const h2 = hashSnapshot(s2);

  assertEqual(h1, h2, 'Snapshot hash ignores property ordering', failedRef);

  const s3 = { ...s1, lat: 41.0 };
  const h3 = hashSnapshot(s3);

  if (h1 === h3) {
    // eslint-disable-next-line no-console
    console.error('FAIL: Different snapshot content should change snapshot hash');
    failedRef.value = true;
  } else {
    // eslint-disable-next-line no-console
    console.log('✓ Snapshot hash changes when snapshot content changes');
  }
}

function runSeedTests(failedRef: { value: boolean }): void {
  const transitHash = sha256Hex('transit-fixture') as TransitHash;
  const stateHash = sha256Hex('state-fixture') as StateHash;
  const rpgAlgoVersion = 'rpg-v1' as RpgAlgoVersion;
  const audioAlgoVersion = 'audio-v1' as AudioAlgoVersion;

  const turnSeed = makeTurnSeed(transitHash, stateHash, rpgAlgoVersion);
  const audioSeed = makeAudioSeed(transitHash, audioAlgoVersion);

  // Golden expectations derived from the current implementation.
  const expectedTurnPayload = `turn:${transitHash}|${stateHash}|${rpgAlgoVersion}`;
  const expectedTurnSeed = sha256Hex(expectedTurnPayload);
  const expectedAudioPayload = `audio:${transitHash}|${audioAlgoVersion}`;
  const expectedAudioSeed = sha256Hex(expectedAudioPayload);

  assertEqual(turnSeed, expectedTurnSeed, 'turn_seed matches sha256(transit_hash|state_hash|rpg_algo_version)', failedRef);
  assertEqual(audioSeed, expectedAudioSeed, 'audio_seed matches sha256(transit_hash|audio_algo_version)', failedRef);
}

function main(): void {
  const failed = { value: false };

  // eslint-disable-next-line no-console
  console.log('Running Phase 7 RPG hashing tests...');
  runJsonHashTests(failed);
  runSnapshotHashTests(failed);
  runSeedTests(failed);

  if (failed.value) {
    // eslint-disable-next-line no-console
    console.error('\n❌ Phase 7 RPG hashing tests failed');
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.log('\n✅ Phase 7 RPG hashing tests passed');
  }
}

main();

