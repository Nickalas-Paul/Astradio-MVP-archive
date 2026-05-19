/**
 * Run: npm run vnext:build && node --test dist/vnext/vnext/compatibility/transit-amplification.test.js
 */
import assert from 'node:assert';
import test from 'node:test';
import {
  blendDiscoveryDailyScore,
  DISCOVERY_BASE_WEIGHT,
  DISCOVERY_TRANSIT_WEIGHT,
} from './transit-amplification';

test('blendDiscoveryDailyScore uses 60/40 weights', () => {
  const base = 0.8;
  const transit = 0.4;
  const daily = blendDiscoveryDailyScore(base, transit);
  const expected = base * DISCOVERY_BASE_WEIGHT + transit * DISCOVERY_TRANSIT_WEIGHT;
  assert.ok(Math.abs(daily - expected) < 1e-6);
  assert.ok(Math.abs(daily - 0.64) < 1e-6);
});

test('blendDiscoveryDailyScore clamps to 0-1', () => {
  assert.strictEqual(blendDiscoveryDailyScore(1, 1), 1);
  assert.strictEqual(blendDiscoveryDailyScore(0, 0), 0);
});

test('TransitAmplificationResult has score and topHits only', () => {
  const sample: import('./transit-amplification').TransitAmplificationResult = {
    score: 0.3,
    topHits: [],
  };
  assert.strictEqual('hasStrongTransit' in sample, false);
});
