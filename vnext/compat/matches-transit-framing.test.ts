/**
 * Run: npm run vnext:build && node --test dist/vnext/vnext/compat/matches-transit-framing.test.js
 */
import assert from 'node:assert';
import test from 'node:test';
import {
  applyTransitFramingToSynastryBullets,
  maybeFrameWithTransit,
  toPublicCompatMatch,
  type CompatMatchResult,
} from './matches';
import type { DirectedSnapshotAspect } from '../synastry/synastry-types';

const aspect = {
  bodyA: 'venus',
  bodyB: 'mars',
  type: 'trine',
  sourceSlotIndex: 0,
  targetSlotIndex: 1,
  exactness: 0.9,
} as DirectedSnapshotAspect;

test('maybeFrameWithTransit adds prefix when transit hits aspect body', () => {
  const bullet =
    'Your Venus and their Mars are trine—natural chemistry flows easily between you.';
  const hits = [{ transitBody: 'mars', natalBody: 'venus', aspectType: 'conjunction' }];

  const framed = maybeFrameWithTransit(bullet, aspect, hits);

  assert.ok(framed.includes('Transit Mars activates this connection today—'));
  assert.ok(framed.includes('natural chemistry flows easily between you.'));
  assert.ok(!framed.includes('Your Venus and their Mars are trine—'));
});

test('maybeFrameWithTransit returns original when no relevant hit', () => {
  const bullet = 'Your Moon and their Moon are trine—emotional rapport.';
  const moonAspect = { ...aspect, bodyA: 'moon', bodyB: 'moon' };
  const hits = [{ transitBody: 'mars', natalBody: 'venus', aspectType: 'conjunction' }];

  assert.strictEqual(maybeFrameWithTransit(bullet, moonAspect, hits), bullet);
});

test('applyTransitFramingToSynastryBullets frames forThem and forYou only', () => {
  const bullets = {
    forThem: { anchor: '', text: 'Your Venus meets their Mars at trine—warmth.' },
    forYou: { anchor: '', text: 'Your Moon and their Venus are sextile—ease.' },
    together: { anchor: '', text: 'Your Mars meets their Mars at square—friction.' },
  };
  const aspects = {
    forThem: aspect,
    forYou: { ...aspect, bodyA: 'moon', bodyB: 'venus' } as DirectedSnapshotAspect,
    together: { ...aspect, bodyA: 'mars', bodyB: 'mars', type: 'square' as const },
  };
  const framed = applyTransitFramingToSynastryBullets(bullets, aspects, {
    hasStrongTransit: true,
    topHits: [
      {
        transitBody: 'mars',
        natalBody: 'venus',
        memberChartId: 'c1',
        aspectType: 'conjunction',
        weight: 1,
      },
    ],
  });

  assert.ok(framed.forThem.text.startsWith('Transit Mars activates'));
  assert.ok(framed.forYou.text.startsWith('Transit'));
  assert.strictEqual(framed.together.text, bullets.together.text);
});

test('applyTransitFramingToSynastryBullets skips when no strong transit', () => {
  const bullets = {
    forThem: { anchor: '', text: 'A' },
    forYou: { anchor: '', text: 'B' },
    together: { anchor: '', text: 'C' },
  };
  const framed = applyTransitFramingToSynastryBullets(bullets, { forThem: aspect }, {
    hasStrongTransit: false,
    topHits: [
      {
        transitBody: 'mars',
        natalBody: 'venus',
        memberChartId: 'c1',
        aspectType: 'conjunction',
        weight: 1,
      },
    ],
  });
  assert.deepStrictEqual(framed, bullets);
});

test('toPublicCompatMatch strips _bulletAspects', () => {
  const full: CompatMatchResult = {
    userId: 'u1',
    chartId: 'c1',
    displayName: 'Test',
    score: 0.5,
    facets: [],
    rationale: '50%',
    explanationProfile: {
      intent: 'friend',
      intentFitSummary: '',
      primarySupports: [],
      secondarySupports: [],
      tensionsOrLimits: [],
    },
    lastUpdated: new Date().toISOString(),
    _bulletAspects: { forThem: aspect },
  };
  const pub = toPublicCompatMatch(full);
  assert.strictEqual('_bulletAspects' in pub, false);
});
