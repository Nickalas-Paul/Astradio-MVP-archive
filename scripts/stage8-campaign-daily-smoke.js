#!/usr/bin/env node
/**
 * Smoke harness for campaign daily + user transit context.
 * Requires: POSTGRES_URL, running engine on API_BASE_URL or localhost:4000, migrated DB.
 * Skips with exit 0 if POSTGRES_URL unset (CI-friendly).
 */
require('dotenv').config();

const { CAMPAIGN_DAILY_ENGINE_VERSION } = require('../server/lib/campaign-runtime');

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.log('[stage8-campaign-daily-smoke] POSTGRES_URL unset — skip');
  process.exit(0);
}

const base = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

async function j(method, path, body, userId) {
  const url = new URL(path, base);
  if (userId) url.searchParams.set('userId', userId);
  const r = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

(async () => {
  const uid = process.env.SMOKE_USER_ID || 'usr_smoke_daily';
  const loc = {
    source: 'browser_geo',
    label: 'Smoke',
    lat: 40.7128,
    lon: -74.006,
    timezone: 'America/New_York',
    resolvedAt: new Date().toISOString(),
  };

  console.log('[1] PUT transit-context');
  const t1 = await j('PUT', '/api/users/me/transit-context', loc, uid);
  if (t1.status !== 200) {
    console.error('FAIL transit-context', t1.status, t1.data);
    process.exit(1);
  }

  const campaignId = process.env.SMOKE_CAMPAIGN_ID;
  if (!campaignId) {
    console.log('[2] SMOKE_CAMPAIGN_ID unset — partial smoke OK (transit-context only)');
    process.exit(0);
  }

  console.log('[2] GET daily (solo expects body via POST for location — using POST)');
  const date = new Date().toISOString().slice(0, 10);
  const time = '12:00';
  const d1 = await j(
    'POST',
    `/api/campaigns/${encodeURIComponent(campaignId)}/daily?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&engineVersion=${encodeURIComponent(CAMPAIGN_DAILY_ENGINE_VERSION)}`,
    { location: loc },
    uid
  );
  if (d1.status !== 200) {
    console.error('FAIL daily first', d1.status, d1.data);
    process.exit(1);
  }
  const daily1 = d1.data && d1.data.daily && d1.data.daily.daily;
  if (
    !daily1 ||
    !daily1.daily_pressure_state ||
    !daily1.challenge_archetype ||
    !daily1.challenge ||
    !Array.isArray(daily1.response_paths) ||
    !daily1.challenge_fingerprint ||
    typeof daily1.state_hash_before !== 'string'
  ) {
    console.error('FAIL daily shape', d1.status, d1.data);
    process.exit(1);
  }

  const d2 = await j(
    'POST',
    `/api/campaigns/${encodeURIComponent(campaignId)}/daily?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&engineVersion=${encodeURIComponent(CAMPAIGN_DAILY_ENGINE_VERSION)}`,
    { location: loc },
    uid
  );
  if (d2.status !== 200 || !d2.data.fromCache) {
    console.error('FAIL daily idempotent', d2.status, d2.data);
    process.exit(1);
  }

  console.log('[stage8-campaign-daily-smoke] OK');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
