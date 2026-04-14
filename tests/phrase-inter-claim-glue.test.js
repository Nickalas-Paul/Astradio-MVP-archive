/**
 * Inter-claim glue literals and mep split alignment.
 * Run: npm run vnext:build && node --test tests/phrase-inter-claim-glue.test.js
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  INTER_CLAIM_GLUE_LITERALS,
  pickInterClaimGlue,
} = require('../dist/vnext/vnext/projection/rule-layer/claim-inter-claim-glue.js');
const { splitMepBodyForTaggedParagraphs } = require('../dist/vnext/vnext/projection/rule-layer/section-ownership.js');

test('glue K is exactly 6', () => {
  assert.equal(INTER_CLAIM_GLUE_LITERALS.length, 6);
});

test('pickInterClaimGlue is deterministic', () => {
  const a = pickInterClaimGlue('A', 'B', 's', 1);
  const b = pickInterClaimGlue('A', 'B', 's', 1);
  assert.equal(a, b);
  assert.ok(INTER_CLAIM_GLUE_LITERALS.includes(a));
});

test('splitMepBodyForTaggedParagraphs splits on each glue literal', () => {
  const g0 = INTER_CLAIM_GLUE_LITERALS[0];
  const g3 = INTER_CLAIM_GLUE_LITERALS[3];
  const body = `First sentence. ${g0} Second sentence. ${g3} Third here.`;
  const parts = splitMepBodyForTaggedParagraphs(body, ['c1', 'c2', 'c3']);
  assert.equal(parts.length, 3);
  assert.ok(parts[0].text.includes('First'));
  assert.ok(parts[1].text.includes('Second'));
  assert.ok(parts[2].text.includes('Third'));
});
