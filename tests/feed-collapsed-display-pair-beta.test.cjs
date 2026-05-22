/**
 * Phase 6D — pair collapsed cards (library feed text, exactly 3 lines).
 * Run: npm run test:beta-collapsed-cards
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let display;
let sel;
try {
  display = require(path.join(__dirname, '../dist/vnext/vnext/api/feed-collapsed-display.js'));
  sel = require(path.join(__dirname, '../dist/vnext/vnext/api/feed-aspect-selection-v1.js'));
} catch {
  display = null;
  sel = null;
}

function hit(overrides) {
  return {
    transitBody: 'jupiter',
    natalBody: 'moon',
    memberChartId: 'c_a',
    type: 'trine',
    orbDeg: 0.4,
    exactness: 0.85,
    dynamics: 'flowing',
    weight: 0.85,
    ...overrides,
  };
}

test('buildFeedCollapsedDisplayPairBetaV1 shows three library sentences', { skip: !display || !sel }, () => {
  const pool = [
    hit({ transitBody: 'jupiter', natalBody: 'moon', type: 'trine' }),
    hit({ transitBody: 'mars', natalBody: 'venus', type: 'square', weight: 0.8 }),
    hit({ transitBody: 'saturn', natalBody: 'sun', type: 'sextile', weight: 0.75 }),
    hit({ transitBody: 'neptune', natalBody: 'mercury', type: 'opposition', weight: 0.5 }),
  ];
  const cardHits = sel.selectFeedAspectsForCard({ hits: pool, feedItemId: 'pair:beta' });
  const out = display.buildFeedCollapsedDisplayPairBetaV1({
    weather: null,
    cardHits,
    partnerChartLabel: 'Mabel QA',
    connectionLabelFallback: 'Mabel QA',
  });
  assert.equal(out.activity_count, 3);
  assert.equal(out.activation_lines.length, 3);
  for (const ln of out.activation_lines) {
    assert.ok(ln.text.length > 50, 'library feed should be multi-sentence');
    assert.ok(!/YOUR|THEIR/.test(ln.text), 'no template YOUR/THEIR lines');
  }
  assert.ok(out.enhanced_title.includes('Mabel QA'));
});

test('buildFeedActivationLinesFromHits rejects wrong count', { skip: !display }, () => {
  assert.throws(() => display.buildFeedActivationLinesFromHits([hit({})]), /expected 3 hits/);
});
