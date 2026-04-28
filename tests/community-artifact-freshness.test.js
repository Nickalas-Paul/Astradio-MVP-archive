const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
  readRelationalExpressionVersionFromDailyArtifact,
  buildRelationalFreshness,
} = require('../lib/community-artifact-freshness');

test('reads expression version from daily weather payload metadata', () => {
  const row = {
    weatherPayload: {
      version: 'relational_weather_v1',
      meta: {
        expressionVersion: 'community_relational_expression_v1',
      },
    },
  };
  assert.equal(
    readRelationalExpressionVersionFromDailyArtifact(row),
    'community_relational_expression_v1'
  );
});

test('missing version is marked historical', () => {
  const freshness = buildRelationalFreshness(COMMUNITY_RELATIONAL_EXPRESSION_VERSION, null);
  assert.equal(freshness.isHistorical, true);
  assert.equal(freshness.reason, 'missing_version');
});

test('version mismatch is marked historical', () => {
  const freshness = buildRelationalFreshness(
    COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
    'community_relational_expression_v0'
  );
  assert.equal(freshness.isHistorical, true);
  assert.equal(freshness.reason, 'version_mismatch');
});

test('current version is reusable', () => {
  const freshness = buildRelationalFreshness(
    COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
    COMMUNITY_RELATIONAL_EXPRESSION_VERSION
  );
  assert.equal(freshness.isCurrent, true);
  assert.equal(freshness.isHistorical, false);
});
