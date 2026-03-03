/**
 * Phase 7 Slice 2 — RPGEffectsBundle builder tests.
 *
 * Asserts:
 * - Bundle determinism under key reordering.
 * - Class/subclass/rising slugs derived from natal snapshot.
 * - Bundle hash stability w.r.t. irrelevant changes, and sensitivity to real changes.
 */

import type { EphemerisSnapshot } from '../contracts';
import { canonicalJsonString } from '../rpg/hash/json-hash';
import { hashSnapshot } from '../rpg/hash/snapshot-hash';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';

function assert(condition: boolean, message: string, failedRef: { value: boolean }): void {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error(`FAIL: ${message}`);
    failedRef.value = true;
  } else {
    // eslint-disable-next-line no-console
    console.log(`✓ ${message}`);
  }
}

function makeFixtureSnapshot(): EphemerisSnapshot {
  return {
    ts: '2026-03-03T00:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 45 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function makeFixtureSnapshotWithReorderedKeys(): EphemerisSnapshot {
  const base = makeFixtureSnapshot();
  const reordered: EphemerisSnapshot = {
    houseSystem: base.houseSystem,
    lon: base.lon,
    lat: base.lat,
    dominantElements: base.dominantElements,
    ts: base.ts,
    tz: base.tz,
    planets: base.planets,
    houses: base.houses,
    aspects: base.aspects,
    moonPhase: base.moonPhase,
  };
  return reordered;
}

function runBundleDeterminismTests(failedRef: { value: boolean }): void {
  const s1 = makeFixtureSnapshot();
  const s2 = makeFixtureSnapshotWithReorderedKeys();

  const b1 = buildRpgEffectsBundleFromSnapshot(s1);
  const b2 = buildRpgEffectsBundleFromSnapshot(s2);

  assert(
    b1.metadata.bundle_hash === b2.metadata.bundle_hash,
    'bundle_hash is stable under snapshot key reordering',
    failedRef
  );

  assert(
    b1.classSlug === b2.classSlug && b1.subclassSlug === b2.subclassSlug,
    'classSlug and subclassSlug stable under snapshot key reordering',
    failedRef
  );

  assert(
    b1.placements.length === b2.placements.length,
    'placements length stable under snapshot key reordering',
    failedRef
  );

  const placements1 = canonicalJsonString(b1.placements);
  const placements2 = canonicalJsonString(b2.placements);
  assert(
    placements1 === placements2,
    'placements ordering and content stable under snapshot key reordering',
    failedRef
  );

  const domains1 = canonicalJsonString(b1.domainSummary);
  const domains2 = canonicalJsonString(b2.domainSummary);
  assert(
    domains1 === domains2,
    'domainSummary ordering and content stable under snapshot key reordering',
    failedRef
  );
}

function runRecognitionTests(failedRef: { value: boolean }): void {
  const snapshot = makeFixtureSnapshot();
  const bundle = buildRpgEffectsBundleFromSnapshot(snapshot);

  assert(
    bundle.classSlug === 'class_aries',
    'classSlug derived from Sun sign Aries',
    failedRef
  );

  assert(
    bundle.subclassSlug === 'subclass_taurus',
    'subclassSlug derived from Moon sign Taurus',
    failedRef
  );

  assert(
    bundle.risingModifierSlug === 'rising_aries',
    'risingModifierSlug derived from ASC sign Aries (house 1 cusp)',
    failedRef
  );
}

function runSnapshotChangeSensitivityTests(failedRef: { value: boolean }): void {
  const s1 = makeFixtureSnapshot();
  const s2: EphemerisSnapshot = {
    ...makeFixtureSnapshot(),
    planets: [
      { name: 'Sun', lon: 45 }, // Taurus instead of Aries
      { name: 'Moon', lon: 45 },
    ],
  };

  const b1 = buildRpgEffectsBundleFromSnapshot(s1);
  const b2 = buildRpgEffectsBundleFromSnapshot(s2);

  assert(
    b1.metadata.bundle_hash !== b2.metadata.bundle_hash,
    'bundle_hash changes when Sun sign (class) changes',
    failedRef
  );
}

function runSnapshotHashStabilityTests(failedRef: { value: boolean }): void {
  const s1 = makeFixtureSnapshot();
  const s2 = makeFixtureSnapshotWithReorderedKeys();

  const h1 = hashSnapshot(s1);
  const h2 = hashSnapshot(s2);

  assert(
    h1 === h2,
    'natal_snapshot_hash is stable under key reordering',
    failedRef
  );
}

function main(): void {
  const failed = { value: false };

  // eslint-disable-next-line no-console
  console.log('Running Phase 7 RPG bundle tests...');

  runBundleDeterminismTests(failed);
  runRecognitionTests(failed);
  runSnapshotChangeSensitivityTests(failed);
  runSnapshotHashStabilityTests(failed);

  if (failed.value) {
    // eslint-disable-next-line no-console
    console.error('\n❌ Phase 7 RPG bundle tests failed');
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.log('\n✅ Phase 7 RPG bundle tests passed');
  }
}

main();

