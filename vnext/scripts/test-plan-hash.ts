/**
 * Unit test: Plan hash determinism
 * Asserts that canonicalizePlan + computePlanHash produce stable hashes
 */

import { computePlanHash, canonicalizePlan } from '../plan-hash';
import type { Plan } from '../contracts';

function makeTestPlan(): Plan {
  return {
    id: 'test-plan-1',
    featureHash: 'abc123',
    durationSec: 60,
    bpm: 120,
    key: 'A minor',
    events: [
      { t0: 0.0, t1: 0.5, pitch: 60, velocity: 0.8, channel: 'melody' as const },
      { t0: 0.5, t1: 1.0, pitch: 64, velocity: 0.7, channel: 'melody' as const },
      { t0: 0.0, t1: 1.0, pitch: 48, velocity: 0.6, channel: 'bass' as const },
      { t0: 0.25, t1: 0.75, pitch: 67, velocity: 0.5, channel: 'harmony' as const }
    ]
  };
}

function main(): void {
  let failed = false;

  // Test 1: Same plan produces same hash
  const plan1 = makeTestPlan();
  const hash1 = computePlanHash(plan1);
  const hash2 = computePlanHash(plan1);
  if (hash1 !== hash2) {
    console.error('FAIL: Same plan produced different hashes');
    console.error(`  hash1: ${hash1}`);
    console.error(`  hash2: ${hash2}`);
    failed = true;
  } else {
    console.log('✓ Same plan produces same hash');
  }

  // Test 2: Canonicalization sorts events deterministically
  const plan2: Plan = {
    ...makeTestPlan(),
    events: [
      { t0: 0.5, t1: 1.0, pitch: 64, velocity: 0.7, channel: 'melody' as const },
      { t0: 0.0, t1: 0.5, pitch: 60, velocity: 0.8, channel: 'melody' as const },
      { t0: 0.25, t1: 0.75, pitch: 67, velocity: 0.5, channel: 'harmony' as const },
      { t0: 0.0, t1: 1.0, pitch: 48, velocity: 0.6, channel: 'bass' as const }
    ]
  };
  const hash3 = computePlanHash(plan2);
  if (hash1 !== hash3) {
    console.error('FAIL: Plan with reordered events produced different hash');
    console.error(`  hash1: ${hash1}`);
    console.error(`  hash3: ${hash3}`);
    failed = true;
  } else {
    console.log('✓ Reordered events produce same hash (canonicalization works)');
  }

  // Test 3: Different plan produces different hash
  const plan3 = {
    ...makeTestPlan(),
    bpm: 140 // Different BPM
  };
  const hash4 = computePlanHash(plan3);
  if (hash1 === hash4) {
    console.error('FAIL: Different plan produced same hash');
    failed = true;
  } else {
    console.log('✓ Different plan produces different hash');
  }

  // Test 4: Canonical form is JSON-serializable and stable
  const canonical1 = canonicalizePlan(plan1);
  const canonical2 = canonicalizePlan(plan2);
  const json1 = JSON.stringify(canonical1);
  const json2 = JSON.stringify(canonical2);
  if (json1 !== json2) {
    console.error('FAIL: Canonical forms differ for same plan');
    failed = true;
  } else {
    console.log('✓ Canonical forms are identical for same plan');
  }

  // Test 5: Time rounding prevents float jitter
  const plan4: Plan = {
    ...makeTestPlan(),
    events: [
      { t0: 0.0001, t1: 0.5001, pitch: 60, velocity: 0.8, channel: 'melody' as const },
      { t0: 0.5, t1: 1.0, pitch: 64, velocity: 0.7, channel: 'melody' as const }
    ]
  };
  const hash5 = computePlanHash(plan4);
  const plan5: Plan = {
    ...makeTestPlan(),
    events: [
      { t0: 0.0, t1: 0.5, pitch: 60, velocity: 0.8, channel: 'melody' as const },
      { t0: 0.5, t1: 1.0, pitch: 64, velocity: 0.7, channel: 'melody' as const }
    ]
  };
  const hash6 = computePlanHash(plan5);
  // Should be same after rounding (0.0001 rounds to 0.0, 0.5001 rounds to 0.5)
  if (hash5 !== hash6) {
    console.error('FAIL: Time rounding not working correctly');
    console.error(`  hash5: ${hash5}`);
    console.error(`  hash6: ${hash6}`);
    failed = true;
  } else {
    console.log('✓ Time rounding prevents float jitter');
  }

  if (failed) {
    console.error('\n❌ Tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All plan hash tests passed');
  }
}

main();
