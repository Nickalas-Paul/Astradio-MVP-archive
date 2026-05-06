/**
 * Phase 6D — ensures built compat layer exports the shared comparison compose core.
 * Requires: npm run vnext:build
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let comparisonService;
try {
  comparisonService = require(path.join(__dirname, '../dist/vnext/vnext/compat/comparison-service.js'));
} catch {
  comparisonService = null;
}

test('comparison-service exports composeComparisonAggregateReading', { skip: !comparisonService }, () => {
  assert.equal(typeof comparisonService.composeComparisonAggregateReading, 'function');
  assert.equal(typeof comparisonService.createComparison, 'function');
});
