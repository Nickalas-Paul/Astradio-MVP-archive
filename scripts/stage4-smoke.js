#!/usr/bin/env node
const assert = require('assert');
const express = require('express');

const stage4Path = require.resolve('../server/routes/stage4');
const pgStorePath = require.resolve('../lib/pg-store');
const composeAdapterPath = require.resolve('../dist/vnext/vnext/relational/composition/group-compose-adapter');

async function withServer(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function request(base, method, path, body) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  return { status: r.status, body: json };
}

async function testMemoryMode501() {
  delete process.env.POSTGRES_URL;
  delete require.cache[stage4Path];
  const { createStage4Router } = require(stage4Path);
  const srv = await withServer(createStage4Router());
  try {
    const r = await request(srv.base, 'GET', '/api/relationships', null);
    assert.equal(r.status, 501);
    assert.equal(r.body.error, 'stage4_requires_postgres');
  } finally {
    await srv.close();
  }
}

async function testPostgresModeSmokes() {
  process.env.POSTGRES_URL = 'mock';
  delete require.cache[stage4Path];
  delete require.cache[pgStorePath];
  delete require.cache[composeAdapterPath];

  const pgStore = require(pgStorePath);
  const compose = require(composeAdapterPath);

  const relById = new Map();
  const relByKey = new Map();
  const groups = new Map([['grp_1', { id: 'grp_1', ownerId: 'usr_owner' }]]);
  const members = new Map([['grp_1', [{ id: 'm2', chartId: 'chart_b' }, { id: 'm1', chartId: 'chart_a' }]]]);
  const artifacts = [];

  pgStore.getChart = async (id) => ({ id, ownerId: id.startsWith('x_') ? 'other' : 'usr_owner' });
  pgStore.createRelationship = async ({ ownerUserId, chartAId, chartBId, label, comparisonId }) => {
    const key = `${ownerUserId}|${chartAId}|${chartBId}|${label}`;
    if (relByKey.has(key)) return relById.get(relByKey.get(key));
    const id = `rel_${relById.size + 1}`;
    const row = { id, ownerUserId, chartIdLow: chartAId, chartIdHigh: chartBId, label, comparisonId: comparisonId || null };
    relById.set(id, row);
    relByKey.set(key, id);
    return row;
  };
  pgStore.listRelationshipsByOwner = async (ownerUserId) =>
    [...relById.values()].filter((r) => r.ownerUserId === ownerUserId);
  pgStore.getRelationshipById = async (id) => relById.get(id);
  pgStore.deleteRelationshipById = async (id, owner) => {
    const row = relById.get(id);
    if (!row || row.ownerUserId !== owner) return false;
    relById.delete(id);
    return true;
  };
  pgStore.getRelationalGroupById = async (id) => groups.get(id);
  pgStore.createRelationalGroup = async ({ ownerId, name }) => ({ id: 'grp_2', ownerId, name });
  pgStore.listRelationalGroupsByOwner = async (ownerId) => [...groups.values()].filter((g) => g.ownerId === ownerId);
  pgStore.addRelationalGroupMember = async ({ groupId, chartId }) => {
    const m = { id: `m_${Date.now()}`, groupId, chartId };
    members.set(groupId, [...(members.get(groupId) || []), m]);
    return m;
  };
  pgStore.removeRelationalGroupMember = async (groupId, memberId, ownerId) => {
    const g = groups.get(groupId);
    if (!g || g.ownerId !== ownerId) return false;
    const list = members.get(groupId) || [];
    const next = list.filter((m) => m.id !== memberId);
    members.set(groupId, next);
    return next.length !== list.length;
  };
  pgStore.listRelationalGroupMembers = async (groupId, ownerId) => {
    const g = groups.get(groupId);
    if (!g || g.ownerId !== ownerId) return undefined;
    return members.get(groupId) || [];
  };
  pgStore.getCompositeArtifactByHash = async (ownerUserId, kind, artifactHash) =>
    artifacts.find((a) => a.ownerUserId === ownerUserId && a.kind === kind && a.artifactHash === artifactHash);
  pgStore.createCompositeArtifact = async (input) => {
    const row = { id: `cpa_${artifacts.length + 1}`, ...input, createdAt: new Date().toISOString() };
    artifacts.push(row);
    return row;
  };

  compose.composeGroupFromChartIds = async (chartIds, opts) => {
    const sorted = [...new Set(chartIds)].sort((a, b) => a.localeCompare(b, 'en'));
    const seed = `${opts?.groupId || 'none'}|${sorted.join(',')}`;
    return {
      provenance: {
        chart_ids: sorted,
        vector_hashes: Object.fromEntries(sorted.map((id) => [id, `vh_${id}`])),
        seed,
        algorithm_version: 'group_compose_v1',
      },
      planHash: `plan_${seed}`,
      compositionId: `plan_${seed}`,
    };
  };

  const { createStage4Router } = require(stage4Path);
  const srv = await withServer(createStage4Router());
  try {
    const unauth = await request(srv.base, 'GET', '/api/relationships', null);
    assert.equal(unauth.status, 401);

    const c1 = await request(srv.base, 'POST', '/api/relationships?userId=usr_owner', {
      chartAId: 'chart_z',
      chartBId: 'chart_a',
      label: 'friend',
    });
    assert.equal(c1.status, 201);
    assert.equal(c1.body.chartIdLow, 'chart_a');
    assert.equal(c1.body.chartIdHigh, 'chart_z');

    const c2 = await request(srv.base, 'POST', '/api/relationships?userId=usr_owner', {
      chartAId: 'chart_a',
      chartBId: 'chart_z',
      label: 'friend',
    });
    assert.equal(c2.status, 201);
    assert.equal(c2.body.id, c1.body.id);

    const forbidden = await request(srv.base, 'GET', `/api/relationships/${c1.body.id}?userId=other`, null);
    assert.equal(forbidden.status, 404);

    const gc1 = await request(srv.base, 'GET', '/api/groups/grp_1/composite?userId=usr_owner', null);
    const gc2 = await request(srv.base, 'GET', '/api/groups/grp_1/composite?userId=usr_owner', null);
    assert.equal(gc1.status, 200);
    assert.equal(gc2.status, 200);
    assert.equal(gc1.body.artifact.artifactHash, gc2.body.artifact.artifactHash);
    assert.equal(gc1.body.artifact.planHash, gc2.body.artifact.planHash);
  } finally {
    await srv.close();
  }
}

async function main() {
  await testMemoryMode501();
  await testPostgresModeSmokes();
  console.log('stage4-smoke: PASS');
}

main().catch((e) => {
  console.error('stage4-smoke: FAIL', e);
  process.exit(1);
});
