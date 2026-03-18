#!/usr/bin/env node
/**
 * Phase 8 Stage 5 — Live verification (Render engine + optional Vercel bypass reachability).
 *
 * Env:
 *   ENGINE_URL — engine base (default: Render prod)
 *   VERCEL_PREVIEW_URL, VERCEL_PROTECTION_BYPASS — Vercel deployment protection bypass (do not commit secrets)
 *   POSTGRES_URL + STAGE5_RUN_MIGRATE=1 — run `scripts/migrate.js` first (Render external DB: append ?sslmode=require)
 */
require('dotenv').config();

const path = require('path');
const { spawnSync } = require('child_process');
if (process.env.STAGE5_RUN_MIGRATE === '1' && process.env.POSTGRES_URL) {
  const root = path.join(__dirname, '..');
  const st = spawnSync(process.execPath, [path.join(__dirname, 'migrate.js')], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (st.status !== 0) process.exit(st.status || 1);
}

const ENGINE = (process.env.ENGINE_URL || 'https://astradio-mvp-archive.onrender.com').replace(/\/$/, '');
const VERCEL = (process.env.VERCEL_PREVIEW_URL || '').replace(/\/$/, '');
const BYPASS = (process.env.VERCEL_PROTECTION_BYPASS || '').trim();

/** Minimal valid RPG snapshot (required bodies per rpg-effects). */
const natal = {
  ts: '1990-01-01T12:00:00Z',
  tz: 'UTC',
  lat: 40.7128,
  lon: -74.006,
  houseSystem: 'placidus',
  planets: [
    { name: 'Sun', lon: 15 },
    { name: 'Moon', lon: 45 },
    { name: 'Mercury', lon: 60 },
    { name: 'Venus', lon: 75 },
    { name: 'Mars', lon: 90 },
    { name: 'Jupiter', lon: 105 },
    { name: 'Saturn', lon: 120 },
    { name: 'Uranus', lon: 135 },
    { name: 'Neptune', lon: 150 },
    { name: 'Pluto', lon: 165 },
  ],
  houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
  aspects: [],
  moonPhase: 0.5,
  dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
};

async function j(method, path, body, qUserId) {
  let p = path;
  if (qUserId) p += (path.includes('?') ? '&' : '?') + `userId=${encodeURIComponent(qUserId)}`;
  const r = await fetch(`${ENGINE}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: r.status, data };
}

function ok(cond, msg, report, section, step) {
  const pass = !!cond;
  if (!report[section]) report[section] = [];
  report[section].push({ step, status: pass ? 'pass' : 'fail', message: pass ? undefined : msg });
  return pass;
}

(async () => {
  const report = { engine: ENGINE, vercel: VERCEL || '(not set)', results: {} };
  let failed = 0;

  const health = await j('GET', '/health');
  if (!ok(health.status === 200, `health ${health.status}`, report.results, 'regression', 'GET /health')) failed++;

  const ownerProfile = await j('POST', '/api/profile', {
    displayName: `Stage5 Owner ${Date.now()}`,
    chart: {
      label: 'S5 Primary',
      date: '1991-01-01',
      time: '09:30',
      lat: 40.7128,
      lon: -74.006,
      timezone: 'America/New_York',
    },
  });
  if (!ok(ownerProfile.status === 201, `profile ${ownerProfile.status}`, report.results, 'setup', 'owner profile')) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  const ownerUserId = ownerProfile.data.user.id;
  const ownerChartA = ownerProfile.data.primaryChart.id;

  const chartB = await j('POST', '/api/charts', {
    ownerId: ownerUserId,
    label: 'S5 Secondary',
    date: '1992-02-02',
    time: '13:15',
    lat: 34.0522,
    lon: -118.2437,
    timezone: 'America/Los_Angeles',
  });
  if (!ok(chartB.status === 201, `chartB ${chartB.status}`, report.results, 'setup', 'second chart')) failed++;
  const ownerChartB = chartB.data.id;

  const otherProfile = await j('POST', '/api/profile', {
    displayName: `Stage5 Other ${Date.now()}`,
    chart: {
      label: 'S5 Other',
      date: '1990-03-03',
      time: '07:45',
      lat: 41.8781,
      lon: -87.6298,
      timezone: 'America/Chicago',
    },
  });
  if (!ok(otherProfile.status === 201, `other profile ${otherProfile.status}`, report.results, 'setup', 'other user')) failed++;
  const otherUserId = otherProfile.data.user.id;

  const soloCreate = await j('POST', '/api/campaigns/create', { mode: 'solo', natalSnapshot: natal }, ownerUserId);
  if (!ok(soloCreate.status === 201 || soloCreate.status === 200, `solo create ${soloCreate.status} ${JSON.stringify(soloCreate.data).slice(0, 200)}`, report.results, 'solo', 'create')) {
    failed++;
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  const soloId = soloCreate.data.campaignId || soloCreate.data.campaign_id;

  const soloGet = await j('GET', `/api/campaigns/${encodeURIComponent(soloId)}`, undefined, ownerUserId);
  if (!ok(soloGet.status === 200, `get ${soloGet.status}`, report.results, 'solo', 'getById')) failed++;

  const soloList = await j('GET', '/api/campaigns', undefined, ownerUserId);
  const list = soloList.data.campaigns || [];
  const inList = list.some((c) => (c.campaignId || c.campaign_id) === soloId);
  if (!ok(soloList.status === 200 && inList, `list ${soloList.status} found=${inList}`, report.results, 'solo', 'list')) failed++;

  const soloEnter = await j('POST', `/api/campaigns/${encodeURIComponent(soloId)}/enter`, {}, ownerUserId);
  if (!ok(soloEnter.status === 200, `enter ${soloEnter.status}`, report.results, 'solo', 'enter')) failed++;

  const soloAgain = await j('POST', '/api/campaigns/create', { mode: 'solo', natalSnapshot: natal }, ownerUserId);
  const soloId2 = soloAgain.data.campaignId || soloAgain.data.campaign_id;
  if (!ok(soloId === soloId2, `repeat create id mismatch ${soloId} vs ${soloId2}`, report.results, 'solo', 'repeatCreateSameCampaign')) failed++;

  const [c1, c2] = await Promise.all([
    j('POST', '/api/campaigns/create', { mode: 'solo', natalSnapshot: natal }, ownerUserId),
    j('POST', '/api/campaigns/create', { mode: 'solo', natalSnapshot: natal }, ownerUserId),
  ]);
  const id1 = c1.data.campaignId || c1.data.campaign_id;
  const id2 = c2.data.campaignId || c2.data.campaign_id;
  if (!ok(id1 === id2 && id1 === soloId, `concurrency ids ${id1} ${id2}`, report.results, 'concurrency', 'parallelCreateSameContext')) failed++;

  const groupCreate = await j('POST', `/api/groups?userId=${encodeURIComponent(ownerUserId)}`, {
    name: `Stage5 Group ${Date.now()}`,
    description: 'stage5 live',
  });
  if (!ok(groupCreate.status === 201, `group ${groupCreate.status}`, report.results, 'group', 'createGroup')) failed++;
  const groupId = groupCreate.data.id;

  const m1 = await j('POST', `/api/groups/${encodeURIComponent(groupId)}/members?userId=${encodeURIComponent(ownerUserId)}`, { chartId: ownerChartB });
  const m2 = await j('POST', `/api/groups/${encodeURIComponent(groupId)}/members?userId=${encodeURIComponent(ownerUserId)}`, { chartId: ownerChartA });
  if (!ok(m1.status === 201 && m2.status === 201, `members ${m1.status} ${m2.status}`, report.results, 'group', 'addMembers')) failed++;

  const comp1 = await j('GET', `/api/groups/${encodeURIComponent(groupId)}/composite?userId=${encodeURIComponent(ownerUserId)}`);
  const comp2 = await j('GET', `/api/groups/${encodeURIComponent(groupId)}/composite?userId=${encodeURIComponent(ownerUserId)}`);
  const artifactId = comp1.data?.artifact?.id;
  const stable = comp1.data?.artifact?.artifactHash === comp2.data?.artifact?.artifactHash;
  if (!ok(comp1.status === 200 && stable, `composite ${comp1.status} stable=${stable}`, report.results, 'group', 'stage4CompositeNoRecomputeOnSecondGet')) failed++;

  const grpCamp = await j('POST', '/api/campaigns/create', { mode: 'group', groupId }, ownerUserId);
  if (!ok(grpCamp.status === 201 || grpCamp.status === 200, `group campaign ${grpCamp.status} ${JSON.stringify(grpCamp.data).slice(0, 300)}`, report.results, 'group', 'createCampaign')) failed++;
  const grpCampId = grpCamp.data.campaignId || grpCamp.data.campaign_id;
  const boundComp = grpCamp.data.compositeArtifactId || grpCamp.data.composite_artifact_id;
  if (artifactId && !ok(boundComp === artifactId, `composite bind ${boundComp} vs ${artifactId}`, report.results, 'group', 'bindsExistingComposite')) failed++;

  const grpCamp2 = await j('POST', '/api/campaigns/create', { mode: 'group', groupId }, ownerUserId);
  const grpCampId2 = grpCamp2.data.campaignId || grpCamp2.data.campaign_id;
  if (!ok(grpCampId === grpCampId2, `group repeat ${grpCampId} ${grpCampId2}`, report.results, 'group', 'repeatCreateSameCampaign')) failed++;

  const auto1 = await j('POST', '/api/campaigns/create', { mode: 'auto' }, ownerUserId);
  const auto2 = await j('POST', '/api/campaigns/create', { mode: 'auto' }, ownerUserId);
  if (auto1.status === 200 || auto1.status === 201) {
    const a1 = auto1.data.campaignId || auto1.data.campaign_id;
    const a2 = auto2.data.campaignId || auto2.data.campaign_id;
    const sig1 = auto1.data.autoResolutionSignature || auto1.data.auto_resolution_signature;
    const sig2 = auto2.data.autoResolutionSignature || auto2.data.auto_resolution_signature;
    if (!ok(a1 === a2, `auto id ${a1} ${a2}`, report.results, 'auto', 'sameCampaignId')) failed++;
    if (!ok(sig1 === sig2, `auto sig`, report.results, 'auto', 'sameSignature')) failed++;
    const p1 = JSON.stringify(auto1.data.participantUserIds || auto1.data.participant_user_ids || []);
    const p2 = JSON.stringify(auto2.data.participantUserIds || auto2.data.participant_user_ids || []);
    if (!ok(p1 === p2, `auto participants`, report.results, 'auto', 'sameParticipants')) failed++;
  } else {
    report.results.auto = [{ step: 'create', status: 'skip', message: `422 expected if no vectors/composite: ${auto1.data?.message || auto1.status}` }];
  }

  const listB = await j('GET', '/api/campaigns', undefined, otherUserId);
  const bCampaigns = listB.data.campaigns || [];
  const leak = bCampaigns.some((c) => (c.campaignId || c.campaign_id) === soloId);
  if (!ok(!leak, 'list leak', report.results, 'isolation', 'listScope')) failed++;

  const getAsB = await j('GET', `/api/campaigns/${encodeURIComponent(soloId)}`, undefined, otherUserId);
  if (!ok(getAsB.status === 404, `get as other ${getAsB.status}`, report.results, 'isolation', 'getForbidden')) failed++;

  const cmp1 = await j('POST', '/api/comparisons', {
    seekerChartId: ownerChartA,
    targetChartId: ownerChartB,
    relationshipMode: 'friends',
    createdBy: ownerUserId,
  });
  const cmp2 = await j('POST', '/api/comparisons', {
    seekerChartId: ownerChartA,
    targetChartId: ownerChartB,
    relationshipMode: 'friends',
    createdBy: ownerUserId,
  });
  if (!ok(cmp1.status === 201 && cmp2.status === 201, `comparisons ${cmp1.status}`, report.results, 'regression', 'stage3 comparisons')) failed++;
  if (!ok(cmp1.data.planHash === cmp2.data.planHash, 'planHash drift', report.results, 'regression', 'determinism comparisons')) failed++;

  if (VERCEL && BYPASS) {
    const r = await fetch(`${VERCEL}/`, {
      headers: { 'x-vercel-protection-bypass': BYPASS },
      redirect: 'follow',
    });
    if (!ok(r.ok, `vercel home ${r.status}`, report.results, 'vercel', 'bypassReachable')) failed++;
    const api = await fetch(`${VERCEL}/api/campaigns`, {
      headers: { 'x-vercel-protection-bypass': BYPASS, Accept: 'application/json' },
    });
    if (!ok(api.status === 401, `vercel /api/campaigns expected 401 without session got ${api.status}`, report.results, 'vercel', 'campaignsRouteExists')) failed++;
  } else {
    report.results.vercel = [{ step: 'bypass', status: 'skip', message: 'VERCEL_PREVIEW_URL or VERCEL_PROTECTION_BYPASS not set' }];
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
