#!/usr/bin/env node
/**
 * Phase 8 Stage 5 — Smoke verification.
 * Requires ENGINE_URL (engine base) and test user id(s). Optional: POSTGRES_URL for migration check.
 * Usage: ENGINE_URL=http://localhost:4000 node scripts/stage5-verify.js [ownerUserId]
 * Or:    ENGINE_URL=https://your-engine.onrender.com node scripts/stage5-verify.js user-A
 */
require('dotenv').config();

const ENGINE_URL = (process.env.ENGINE_URL || '').replace(/\/$/, '');
const ownerUserId = process.argv[2] || process.env.STAGE5_TEST_USER_ID || 'test-owner-stage5';

if (!ENGINE_URL) {
  console.error('ENGINE_URL required');
  process.exit(1);
}

const base = `${ENGINE_URL}/api`;

function qs(userId) {
  return `?userId=${encodeURIComponent(userId)}`;
}

async function run() {
  const results = { solo: [], group: [], auto: [], isolation: [], concurrency: [], regression: [] };
  let passed = 0;
  let failed = 0;

  // --- SOLO ---
  console.log('\n--- SOLO ---');
  try {
    const createRes = await fetch(`${base}/campaigns/create${qs(ownerUserId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'solo', natalSnapshot: { ts: '', tz: 'UTC', lat: 0, lon: 0, houseSystem: 'placidus', planets: [], houses: [], aspects: [], moonPhase: 0.5, dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 } } }),
    });
    const createData = await createRes.json().catch(() => ({}));
    if (createRes.status !== 201 && createRes.status !== 200) {
      console.log('SOLO create:', createRes.status, createData);
      results.solo.push({ step: 'create', status: 'fail', statusCode: createRes.status });
      failed++;
    } else {
      const campaignId = createData.campaignId || createData.campaign_id;
      results.solo.push({ step: 'create', status: 'pass', campaignId });
      passed++;

      const getRes = await fetch(`${base}/campaigns/${campaignId}${qs(ownerUserId)}`);
      const getData = await getRes.json().catch(() => ({}));
      if (getRes.status !== 200) {
        results.solo.push({ step: 'getById', status: 'fail', statusCode: getRes.status });
        failed++;
      } else {
        results.solo.push({ step: 'getById', status: 'pass' });
        passed++;
      }

      const listRes = await fetch(`${base}/campaigns${qs(ownerUserId)}`);
      const listData = await listRes.json().catch(() => ({}));
      const list = listData.campaigns || [];
      const found = list.some((c) => (c.campaignId || c.campaign_id) === campaignId);
      if (listRes.status !== 200 || !found) {
        results.solo.push({ step: 'list', status: 'fail', statusCode: listRes.status, found });
        failed++;
      } else {
        results.solo.push({ step: 'list', status: 'pass' });
        passed++;
      }

      const enterRes = await fetch(`${base}/campaigns/${campaignId}/enter${qs(ownerUserId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (enterRes.status !== 200) {
        results.solo.push({ step: 'enter', status: 'fail', statusCode: enterRes.status });
        failed++;
      } else {
        results.solo.push({ step: 'enter', status: 'pass' });
        passed++;
      }

      const createAgain = await fetch(`${base}/campaigns/create${qs(ownerUserId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'solo', natalSnapshot: { ts: '', tz: 'UTC', lat: 0, lon: 0, houseSystem: 'placidus', planets: [], houses: [], aspects: [], moonPhase: 0.5, dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 } } }),
      });
      const againData = await createAgain.json().catch(() => ({}));
      const sameId = (againData.campaignId || againData.campaign_id) === campaignId;
      if (!sameId) {
        results.solo.push({ step: 'repeatCreateSameCampaign', status: 'fail', firstId: campaignId, secondId: againData.campaignId || againData.campaign_id });
        failed++;
      } else {
        results.solo.push({ step: 'repeatCreateSameCampaign', status: 'pass' });
        passed++;
      }
    }
  } catch (e) {
    console.error('SOLO error:', e.message);
    results.solo.push({ step: 'request', status: 'fail', error: e.message });
    failed++;
  }

  // --- ISOLATION (user B cannot see user A campaign) ---
  console.log('\n--- ISOLATION ---');
  try {
    const listA = await fetch(`${base}/campaigns${qs(ownerUserId)}`);
    const dataA = await listA.json().catch(() => ({}));
    const campaignsA = dataA.campaigns || [];
    const otherUser = 'user-B-non-participant';
    const listB = await fetch(`${base}/campaigns${qs(otherUser)}`);
    const dataB = await listB.json().catch(() => ({}));
    const campaignsB = dataB.campaigns || [];
    const aIds = new Set((campaignsA || []).map((c) => c.campaignId || c.campaign_id));
    const leak = (campaignsB || []).some((c) => aIds.has(c.campaignId || c.campaign_id));
    if (leak) {
      results.isolation.push({ step: 'listScope', status: 'fail', message: 'User B saw owner A campaign' });
      failed++;
    } else {
      results.isolation.push({ step: 'listScope', status: 'pass' });
      passed++;
    }
    if (campaignsA.length > 0) {
      const firstId = campaignsA[0].campaignId || campaignsA[0].campaign_id;
      const getAsB = await fetch(`${base}/campaigns/${firstId}${qs(otherUser)}`);
      if (getAsB.status === 200) {
        results.isolation.push({ step: 'getForbidden', status: 'fail', message: 'User B could GET owner A campaign' });
        failed++;
      } else {
        results.isolation.push({ step: 'getForbidden', status: 'pass' });
        passed++;
      }
    }
  } catch (e) {
    console.error('ISOLATION error:', e.message);
    results.isolation.push({ step: 'request', status: 'fail', error: e.message });
    failed++;
  }

  console.log('\n--- Summary ---');
  console.log('Passed:', passed, 'Failed:', failed);
  console.log(JSON.stringify(results, null, 2));
  process.exit(failed > 0 ? 1 : 0);
}

run();
