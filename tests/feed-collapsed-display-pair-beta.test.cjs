/**
 * Phase 6D / 8A-Delta — pair collapsed cards (directional synastry, exactly 3 lines).
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
    memberChartId: 'c_partner',
    type: 'trine',
    orbDeg: 0.4,
    exactness: 0.85,
    dynamics: 'flowing',
    weight: 0.85,
    ...overrides,
  };
}

test('buildFeedCollapsedDisplayPairBetaV1 shows three directional activation lines', { skip: !display || !sel }, () => {
  const viewerChartId = 'c_viewer';
  const partnerChartId = 'c_partner';
  const pool = [
    hit({ transitBody: 'jupiter', natalBody: 'moon', type: 'trine' }),
    hit({ transitBody: 'mars', natalBody: 'venus', type: 'square', weight: 0.8, dynamics: 'tense' }),
    hit({ transitBody: 'saturn', natalBody: 'sun', type: 'sextile', weight: 0.75, memberChartId: viewerChartId }),
    hit({ transitBody: 'neptune', natalBody: 'mercury', type: 'opposition', weight: 0.5 }),
  ];
  const cardHits = sel.selectFeedAspectsForCard({
    hits: pool,
    feedItemId: 'pair:beta',
    viewerChartId,
    partnerChartId,
  });
  const out = display.buildFeedCollapsedDisplayPairBetaV1({
    weather: null,
    cardHits,
    partnerChartLabel: 'Mabel QA',
    connectionLabelFallback: 'Mabel QA',
    viewerChartId,
    partnerChartId,
  });
  assert.equal(out.activity_count, 3);
  assert.equal(out.activation_lines.length, 3);
  for (const ln of out.activation_lines) {
    assert.ok(ln.text.length > 20, 'activation line should have prose');
    assert.ok(['you_bring', 'they_bring', 'tests_both'].includes(ln.role), 'each line has a role');
  }
  assert.ok(
    out.activation_lines.some((ln) =>
      /Your transiting|Their transiting|Transiting /.test(ln.text)
    ),
    'lines use directional transit framing'
  );
  assert.ok(out.enhanced_title.includes('Mabel QA'));
});

test('buildFeedActivationLinesFromHits rejects wrong count', { skip: !display }, () => {
  assert.throws(
    () => display.buildFeedActivationLinesFromHits([hit({})], 'c_viewer', 'c_partner'),
    /expected 3 hits/
  );
});
