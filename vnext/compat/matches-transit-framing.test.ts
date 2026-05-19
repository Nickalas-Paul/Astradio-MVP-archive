/**
 * Run: npm run vnext:build && node --test dist/vnext/vnext/compat/matches-transit-framing.test.js
 */
import assert from 'node:assert';
import test from 'node:test';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import type { AspectInsight } from '../projection/insight-library/insight-library-types';
import type { DirectedSnapshotAspect } from '../synastry/synastry-types';
import {
  applyTransitFeedToSynastryBullets,
  capBulletText,
  findRelevantTransitHit,
  resolveTransitAwareBulletText,
  toPublicCompatMatch,
  type CompatMatchResult,
} from './matches';

const venusMarsAspect = {
  bodyA: 'venus',
  bodyB: 'mars',
  type: 'trine',
  sourceSlotIndex: 0,
  targetSlotIndex: 1,
  exactness: 0.9,
} as DirectedSnapshotAspect;

const mockVenusMarsInsight: Pick<AspectInsight, 'feed' | 'romantic_synastry'> = {
  feed:
    'The current sky is amplifying the natural ease between wanting and reaching in this connection. The grace that runs between these charts is more available today, and something in this dynamic is worth opening right now.',
  romantic_synastry:
    'Your Venus and their Mars are trine—natural chemistry flows easily between you.',
};

test('resolveTransitAwareBulletText uses feed when transit aligns', () => {
  const transitHit = { transitBody: 'mars', natalBody: 'venus', aspectType: 'conjunction' };
  const timelessText = 'Your Venus and their Mars are trine—natural chemistry flows easily between you.';

  const result = resolveTransitAwareBulletText({
    aspect: venusMarsAspect,
    insight: mockVenusMarsInsight as AspectInsight,
    transitHit,
    timelessText,
  });

  assert.strictEqual(result, mockVenusMarsInsight.feed);
  assert.ok(!result.includes('Transit'));
  assert.ok(result.includes('current sky'));
});

test('resolveTransitAwareBulletText uses timeless when no transit alignment', () => {
  const moonAspect = { ...venusMarsAspect, bodyA: 'moon', bodyB: 'moon' };
  const insight = {
    feed: 'The current sky is highlighting emotional resonance in this connection.',
    romantic_synastry: 'Your Moon and their Moon are trine—emotional ease.',
  };
  const transitHit = { transitBody: 'jupiter', natalBody: 'mercury', aspectType: 'trine' };
  const timelessText = 'Your Moon and their Moon are trine—emotional ease.';

  const result = resolveTransitAwareBulletText({
    aspect: moonAspect,
    insight: insight as AspectInsight,
    transitHit,
    timelessText,
  });

  assert.strictEqual(result, timelessText);
  assert.ok(!result.includes('current sky'));
});

test('resolveTransitAwareBulletText caps feed text at 280 chars', () => {
  const longFeed = `${'The current sky is amplifying. '.repeat(20)}`.trim();
  assert.ok(longFeed.length > 280);

  const result = resolveTransitAwareBulletText({
    aspect: venusMarsAspect,
    insight: { feed: longFeed, romantic_synastry: 'Short' } as AspectInsight,
    transitHit: { transitBody: 'mars', natalBody: 'venus', aspectType: 'conjunction' },
    timelessText: 'fallback',
  });

  assert.ok(result.length <= 280);
});

test('capBulletText preserves sentence boundaries when possible', () => {
  const text = 'First sentence. Second sentence. Third sentence that goes over limit.';
  const capped = capBulletText(text, 43);

  assert.strictEqual(capped, 'First sentence. Second sentence.');
  assert.ok(capped.endsWith('.'));
});

test('findRelevantTransitHit excludes already-used hits', () => {
  const hit1 = { transitBody: 'mars', natalBody: 'venus', aspectType: 'conjunction' };
  const hit2 = { transitBody: 'jupiter', natalBody: 'moon', aspectType: 'trine' };
  const moonAspect = { ...venusMarsAspect, bodyA: 'moon', bodyB: 'venus' };

  const first = findRelevantTransitHit(venusMarsAspect, [hit1, hit2]);
  assert.deepStrictEqual(first, hit1);

  const second = findRelevantTransitHit(moonAspect, [hit1, hit2], hit1 ? [hit1] : []);
  assert.deepStrictEqual(second, hit2);
});

test('applyTransitFeedToSynastryBullets uses feed for aligned bullets only', () => {
  const bullets = {
    forThem: { anchor: '', text: 'Your Venus meets their Mars at trine—warmth.' },
    forYou: { anchor: '', text: 'Your Moon and their Venus are sextile—ease.' },
    together: { anchor: '', text: 'Your Mars meets their Mars at square—friction.' },
  };
  const aspects = {
    forThem: venusMarsAspect,
    forYou: { ...venusMarsAspect, bodyA: 'moon', bodyB: 'venus' } as DirectedSnapshotAspect,
    together: { ...venusMarsAspect, bodyA: 'mars', bodyB: 'mars', type: 'square' as const },
  };

  const libraryFeed = getAspectInsight(buildAspectKey('venus', 'mars', 'trine'))?.feed;
  assert.ok(libraryFeed?.includes('current sky'));

  const framed = applyTransitFeedToSynastryBullets(bullets, aspects, {
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

  assert.ok(framed.forThem.text.includes('current sky'));
  assert.ok(!framed.forThem.text.includes('Transit'));
  assert.strictEqual(framed.forYou.text, bullets.forYou.text);
  assert.strictEqual(framed.together.text, bullets.together.text);
});

test('applyTransitFeedToSynastryBullets skips when no strong transit', () => {
  const bullets = {
    forThem: { anchor: '', text: 'A' },
    forYou: { anchor: '', text: 'B' },
    together: { anchor: '', text: 'C' },
  };
  const framed = applyTransitFeedToSynastryBullets(bullets, { forThem: venusMarsAspect }, {
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

test('all personal planet aspect keys have feed field', () => {
  const personalPairs = [
    'SUN_MOON',
    'SUN_VENUS',
    'SUN_MARS',
    'MOON_VENUS',
    'MOON_MARS',
    'VENUS_VENUS',
    'VENUS_MARS',
    'MERCURY_MERCURY',
    'MERCURY_VENUS',
    'MERCURY_MARS',
    'SUN_SUN',
    'SUN_MERCURY',
    'MOON_MOON',
    'MOON_MERCURY',
    'MARS_MARS',
  ];
  const aspectTypes = ['CONJUNCTION', 'OPPOSITION', 'SQUARE', 'TRINE', 'SEXTILE'] as const;
  const missing: string[] = [];

  for (const pair of personalPairs) {
    for (const type of aspectTypes) {
      const key = `${pair}_${type}`;
      const insight = getAspectInsight(key);
      if (!insight?.feed?.trim()) {
        missing.push(key);
      }
    }
  }

  assert.deepStrictEqual(missing, []);
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
    _bulletAspects: { forThem: venusMarsAspect },
  };
  const pub = toPublicCompatMatch(full);
  assert.strictEqual('_bulletAspects' in pub, false);
});
