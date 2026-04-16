/**
 * @import { test } from 'node:test';
 * @import assert from 'node:assert';
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  campaignDailyTransitContextFingerprint,
} = require('../server/lib/campaign-daily-transit-fingerprint');
const { transitContextFingerprint } = require('../server/lib/canonical-location');

describe('campaign-daily-transit-fingerprint (Campaign-only day identity)', () => {
  const loc = {
    source: 'geofinder',
    label: 'Test City',
    lat: 40.7128,
    lon: -74.006,
    timezone: 'America/New_York',
    resolvedAt: '2026-01-15T12:00:00.000Z',
  };
  const date = '2026-04-10';

  it('same date + same location: fingerprint is stable (no clock time in hash)', () => {
    const a = campaignDailyTransitContextFingerprint(loc, date);
    const b = campaignDailyTransitContextFingerprint(loc, date);
    assert.strictEqual(a, b);
  });

  it('same location + different calendar_date produces different fingerprints', () => {
    const a = campaignDailyTransitContextFingerprint(loc, '2026-04-10');
    const b = campaignDailyTransitContextFingerprint(loc, '2026-04-11');
    assert.notStrictEqual(a, b);
  });

  it('different lat produces different fingerprints', () => {
    const a = campaignDailyTransitContextFingerprint(loc, date);
    const b = campaignDailyTransitContextFingerprint({ ...loc, lat: loc.lat + 0.01 }, date);
    assert.notStrictEqual(a, b);
  });

  it('legacy shared transitContextFingerprint differs when time changes; Campaign day fp does not take time', () => {
    const day = campaignDailyTransitContextFingerprint(loc, date);
    const legacyNoon = transitContextFingerprint(loc, date, '12:00');
    const legacyEvening = transitContextFingerprint(loc, date, '18:30');
    assert.notStrictEqual(legacyNoon, legacyEvening, 'shared helper remains time-sensitive');
    assert.notStrictEqual(day, legacyNoon);
    assert.notStrictEqual(day, legacyEvening);
    const dayAgain = campaignDailyTransitContextFingerprint(loc, date);
    assert.strictEqual(day, dayAgain);
  });
});

describe('campaign_daily_state singleton key (no multiple dailies per day)', () => {
  it('insert uses ON CONFLICT on (campaign_id, calendar_date, engine_version)', () => {
    const pg = fs.readFileSync(path.join(__dirname, '../lib/pg-store.js'), 'utf8');
    assert.ok(
      pg.includes('ON CONFLICT (campaign_id, calendar_date, engine_version)'),
      'expected unique daily row per campaign/day/engine',
    );
  });
});

describe('Option A complete-cache contract (documented)', () => {
  it('complete rows require campaign_resolution, challenge, and challenge_fingerprint fields', () => {
    const incomplete = { daily: { campaign_resolution: {}, challenge: { id: 'x' } } };
    const complete = {
      daily: {
        campaign_resolution: { x: 1 },
        challenge: { id: 'scene' },
        challenge_fingerprint: 'fp',
      },
    };
    const isComplete = (j) =>
      j &&
      j.daily &&
      j.daily.campaign_resolution &&
      j.daily.challenge &&
      j.daily.challenge_fingerprint;
    assert.ok(!isComplete(incomplete));
    assert.ok(isComplete(complete));
  });
});
