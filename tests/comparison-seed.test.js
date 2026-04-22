const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

let comparisonSeed;
try {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  comparisonSeed = require(path.join(
    __dirname,
    '../dist/vnext/vnext/compat/payload-from-seed.js'
  )).comparisonSeed;
} catch {
  comparisonSeed = null;
}

describe('comparisonSeed pair canonicalization', { skip: !comparisonSeed }, () => {
  it('A+B vs B+A produces identical seed', () => {
    const mode = 'friend';
    const fusion = 'blend_v1';
    const wA = 0.5;
    const wB = 0.5;
    const a = 'chart_aaa';
    const b = 'chart_bbb';
    const s1 = comparisonSeed(a, b, mode, fusion, wA, wB);
    const s2 = comparisonSeed(b, a, mode, fusion, wA, wB);
    assert.strictEqual(s1, s2);
  });

  it('different pairs produce different seeds', () => {
    const mode = 'friend';
    const fusion = 'blend_v1';
    const s1 = comparisonSeed('c1', 'c2', mode, fusion, 0.5, 0.5);
    const s2 = comparisonSeed('c1', 'c3', mode, fusion, 0.5, 0.5);
    assert.notStrictEqual(s1, s2);
  });
});
