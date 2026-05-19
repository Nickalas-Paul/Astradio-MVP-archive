/**
 * Run: npm run vnext:build && node --test dist/vnext/vnext/compat/matches-transit-ranking.test.js
 */
import assert from 'node:assert';
import test from 'node:test';
import { blendDiscoveryDailyScore } from '../compatibility/transit-amplification';
import { toPublicCompatMatch, type CompatMatchResult } from './matches';

test('toPublicCompatMatch strips scoring fields', () => {
  const full: CompatMatchResult = {
    userId: 'u1',
    chartId: 'c1',
    displayName: 'Test',
    score: 0.9,
    facets: [{ id: 'cohesion', name: 'Cohesion', weight: 1, score: 0.8, explanation: 'x' }],
    rationale: '90% match',
    explanationProfile: {
      intent: 'friend',
      intentFitSummary: '',
      primarySupports: [],
      secondarySupports: [],
      tensionsOrLimits: [],
    },
    lastUpdated: new Date().toISOString(),
    _transitMeta: { hasStrongTransit: true, topHits: [] },
  };
  const pub = toPublicCompatMatch(full);
  assert.strictEqual('score' in pub, false);
  assert.strictEqual('rationale' in pub, false);
  assert.strictEqual('facets' in pub, false);
  assert.strictEqual('_transitMeta' in pub, false);
  assert.strictEqual(pub.chartId, 'c1');
});

test('transit boost can reorder candidates vs base-only', () => {
  const baseA = 0.85;
  const baseB = 0.7;
  const transitA = 0.2;
  const transitB = 0.95;
  const dailyA = blendDiscoveryDailyScore(baseA, transitA);
  const dailyB = blendDiscoveryDailyScore(baseB, transitB);
  assert.ok(dailyB > dailyA, 'higher transit should overcome lower base');
});
