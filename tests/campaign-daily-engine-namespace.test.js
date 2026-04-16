/**
 * Ensures default Campaign daily namespace advances when pre-refinement rows must be retired.
 * @import { test } from 'node:test';
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { CAMPAIGN_DAILY_ENGINE_VERSION } = require('../server/lib/campaign-runtime');

describe('CAMPAIGN_DAILY_ENGINE_VERSION', () => {
  it('uses a phase1 namespace string', () => {
    assert.ok(
      /^campaign_daily_phase1_v\d+$/.test(CAMPAIGN_DAILY_ENGINE_VERSION),
      `unexpected engine version: ${CAMPAIGN_DAILY_ENGINE_VERSION}`
    );
  });

  it('is not the legacy v1 key (stale artifact namespace)', () => {
    assert.notStrictEqual(CAMPAIGN_DAILY_ENGINE_VERSION, 'campaign_daily_phase1_v1');
  });
});
