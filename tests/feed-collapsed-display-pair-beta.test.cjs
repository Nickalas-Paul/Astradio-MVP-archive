/**
 * Phase 6D Beta — pair collapsed activation lines (deterministic fallbacks).
 * Run: npm run test:beta-collapsed-cards
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let mod;
try {
  mod = require(path.join(__dirname, '../dist/vnext/vnext/api/feed-collapsed-display.js'));
} catch {
  mod = null;
}

test(
  'buildPairActivationLinesBeta returns three non-empty lines when hits empty',
  { skip: !mod },
  () => {
    const lines = mod.buildPairActivationLinesBeta({
      weather: { themes: { dominantThemes: ['mutability'] } },
      topCrossAspects: [],
      viewerPrimaryChartId: 'c_a',
      partnerChartId: 'c_b',
    });
    assert.equal(lines.length, 3);
    for (const ln of lines) {
      assert.ok(ln.text && ln.text.trim().length > 0);
      assert.ok(['you', 'them', 'shared'].includes(ln.member_scope));
    }
  }
);

test(
  'buildPairActivationLinesBeta assigns YOUR/THEIR when hits exist',
  { skip: !mod },
  () => {
    const hitYou = {
      transitBody: 'mars',
      natalBody: 'venus',
      memberChartId: 'c_a',
      type: 'square',
      orbDeg: 0.3,
      exactness: 0.9,
      dynamics: 'tense',
      weight: 1,
    };
    const hitThem = {
      transitBody: 'jupiter',
      natalBody: 'moon',
      memberChartId: 'c_b',
      type: 'trine',
      orbDeg: 0.4,
      exactness: 0.85,
      dynamics: 'flowing',
      weight: 1,
    };
    const hitExtra = {
      transitBody: 'saturn',
      natalBody: 'sun',
      memberChartId: 'c_a',
      type: 'sextile',
      orbDeg: 0.5,
      exactness: 0.8,
      dynamics: 'supportive',
      weight: 0.9,
    };
    const lines = mod.buildPairActivationLinesBeta({
      weather: null,
      topCrossAspects: [hitYou, hitThem, hitExtra],
      viewerPrimaryChartId: 'c_a',
      partnerChartId: 'c_b',
    });
    assert.match(lines[0].text, /YOUR/i);
    assert.match(lines[1].text, /THEIR/i);
    assert.ok(lines[2].text.length > 0);
    assert.ok(lines[0].text.length <= 82);
  }
);
