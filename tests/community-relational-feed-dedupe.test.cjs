/**
 * Community relational feed: canonical pair row selection (no DB).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// dist path after: npm run vnext:build
const modPath = path.join(__dirname, '..', 'dist', 'vnext', 'vnext', 'api', 'community-relational-feed.js');
let selectCanonicalPairRowsForFeed;

test.before(async () => {
  try {
    const mod = require(modPath);
    selectCanonicalPairRowsForFeed = mod.selectCanonicalPairRowsForFeed;
  } catch (e) {
    throw new Error(
      `Load ${modPath} failed. Run: npm run vnext:build. Underlying: ${(e && e.message) || e}`
    );
  }
});

test('dedupes two Option-B rows: viewer-owned id wins', () => {
  const viewer = 'user_a';
  const rows = [
    { id: 'rel_zzz', ownerUserId: viewer, chartIdLow: 'c1', chartIdHigh: 'c2', label: 'Friend' },
    { id: 'rel_aaa', ownerUserId: 'user_b', chartIdLow: 'c1', chartIdHigh: 'c2', label: 'Friend' },
  ];
  const out = selectCanonicalPairRowsForFeed(viewer, rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'rel_zzz');
});

test('tie-break: lexicographic smallest id when both match viewer (same label+charts)', () => {
  const v = 'u1';
  const rows = [
    { id: 'rel_m', ownerUserId: v, chartIdLow: 'a', chartIdHigh: 'b', label: 'L' },
    { id: 'rel_a', ownerUserId: v, chartIdLow: 'a', chartIdHigh: 'b', label: 'L' },
  ];
  const out = selectCanonicalPairRowsForFeed(v, rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'rel_a');
});

test('separate groups for different labels', () => {
  const v = 'u1';
  const rows = [
    { id: 'rel_1', ownerUserId: v, chartIdLow: 'a', chartIdHigh: 'b', label: 'A' },
    { id: 'rel_2', ownerUserId: v, chartIdLow: 'a', chartIdHigh: 'b', label: 'B' },
  ];
  const out = selectCanonicalPairRowsForFeed(v, rows);
  assert.equal(out.length, 2);
});
