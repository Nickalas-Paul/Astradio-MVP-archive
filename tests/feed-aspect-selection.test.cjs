/**
 * Phase 6D — feed aspect selection (library coverage + tier priority + invariant).
 * Run: npm run vnext:build && node --test tests/feed-aspect-selection.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let sel;
let insight;
let feedKey;
try {
  sel = require(path.join(__dirname, '../dist/vnext/vnext/api/feed-aspect-selection-v1.js'));
  insight = require(path.join(__dirname, '../dist/vnext/vnext/projection/insight/feed-aspect-insight-v1.js'));
  feedKey = require(path.join(__dirname, '../dist/vnext/vnext/api/feed-displayed-aspect-v1.js')).feedDisplayedAspectKey;
} catch {
  sel = null;
  insight = null;
  feedKey = null;
}

function hit(overrides) {
  return {
    transitBody: 'mars',
    natalBody: 'venus',
    memberChartId: 'c_a',
    type: 'square',
    orbDeg: 0.5,
    exactness: 0.8,
    dynamics: 'tense',
    weight: 1,
    ...overrides,
  };
}

test('selectFeedAspectsForCard returns 3 library lines for diverse pool', { skip: !sel }, () => {
  const pool = [];
  const bodies = ['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = 0; j < bodies.length; j++) {
      if (i === j) continue;
      pool.push(
        hit({
          transitBody: 'jupiter',
          natalBody: bodies[j],
          type: 'trine',
          weight: 1 - i * 0.01,
          memberChartId: 'c_a',
        })
      );
    }
  }
  const picked = sel.selectFeedAspectsForCard({ hits: pool, feedItemId: 'pair:test' });
  assert.equal(picked.length, 3);
  for (const h of picked) {
    assert.ok(insight.isFeedLibraryCovered(h));
    assert.ok(insight.feedDisplayTextForHit(h).length > 40);
  }
});

test('Jupiter tier beats higher-weight Pluto when both covered', { skip: !sel }, () => {
  const pool = [
    hit({
      transitBody: 'pluto',
      natalBody: 'sun',
      type: 'square',
      weight: 0.95,
      orbDeg: 0.2,
    }),
    hit({
      transitBody: 'jupiter',
      natalBody: 'moon',
      type: 'trine',
      weight: 0.85,
      orbDeg: 0.4,
    }),
    hit({
      transitBody: 'saturn',
      natalBody: 'mars',
      type: 'sextile',
      weight: 0.7,
      orbDeg: 0.5,
    }),
  ];
  const picked = sel.selectFeedAspectsForCard({ hits: pool, feedItemId: 'pair:tier' });
  assert.equal(picked[0].transitBody.toLowerCase(), 'jupiter');
});

test('throws FeedAspectCoverageInvariantError when fewer than 3 unique covered keys', { skip: !sel }, () => {
  const pool = [
    hit({ transitBody: 'jupiter', natalBody: 'moon', type: 'trine', weight: 1 }),
    hit({ transitBody: 'jupiter', natalBody: 'venus', type: 'square', weight: 0.9 }),
  ];
  assert.throws(
    () => sel.selectFeedAspectsForCard({ hits: pool, feedItemId: 'pair:fail' }),
    (e) => e && e.code === 'FEED_ASPECT_COVERAGE_INVARIANT'
  );
});

test('recent window deprioritizes key in tier 1 then uses in tier 2', { skip: !sel }, () => {
  const jm = hit({ transitBody: 'jupiter', natalBody: 'moon', type: 'trine', weight: 1 });
  const jv = hit({ transitBody: 'jupiter', natalBody: 'venus', type: 'square', weight: 0.95 });
  const sm = hit({ transitBody: 'saturn', natalBody: 'mars', type: 'sextile', weight: 0.9 });
  const pool = [jm, jv, sm];
  const picked = sel.selectFeedAspectsForCard({
    hits: pool,
    feedItemId: 'pair:win',
    recentKeyWindow: [feedKey(jm)],
  });
  assert.equal(picked.length, 3);
  const keys = picked.map((h) => feedKey(h));
  assert.ok(keys.includes(feedKey(jv)));
});
