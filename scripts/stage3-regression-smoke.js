#!/usr/bin/env node
const assert = require('assert');
const express = require('express');

const routesPath = require.resolve('../dist/vnext/vnext/compat/routes');
const storagePath = require.resolve('../dist/vnext/vnext/compat/storage');
const comparisonSvcPath = require.resolve('../dist/vnext/vnext/compat/comparison-service');

async function withServer(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
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

function deterministicHash(input) {
  const s = JSON.stringify(input);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `plan_${Math.abs(h)}`;
}

async function main() {
  delete require.cache[routesPath];
  delete require.cache[storagePath];
  delete require.cache[comparisonSvcPath];

  const storage = require(storagePath);
  const comparisonSvc = require(comparisonSvcPath);

  const comparisons = new Map();

  storage.setStorage({
    createUser: async () => ({ id: 'u1', displayName: 'User' }),
    getUser: async () => ({ id: 'u1', displayName: 'User' }),
    createChart: async () => ({ id: 'c' }),
    getChart: async () => ({ id: 'c' }),
    listChartsByOwner: async () => [],
    createComparison: async (input) => input,
    getComparison: async (id) => comparisons.get(id),
    listComparisonsByUser: async (userId) => [...comparisons.values()].filter((x) => x.createdBy === userId),
    ensureDefaultProfileChart: async () => ({ id: 'chart_profile_default' }),
    ensureMatchCandidateCharts: async () => [],
    setUserPrimaryChart: async () => {},
    getUserPrimaryChart: async () => undefined,
  });

  comparisonSvc.createComparison = async (input) => {
    const planHash = deterministicHash(input);
    const id = `cmp_${planHash}`;
    const comparison = {
      id,
      chartAId: input.chartAId,
      chartBId: input.chartBId,
      seekerChartId: input.seekerChartId || input.chartAId,
      targetChartId: input.targetChartId || input.chartBId,
      relationshipMode: input.relationshipMode,
      createdBy: input.createdBy || null,
    };
    comparisons.set(id, comparison);
    return { comparison, planHash, compositionId: planHash };
  };

  const { createCompatRouter } = require(routesPath);
  const srv = await withServer(createCompatRouter());
  try {
    const create1 = await request(srv.base, 'POST', '/api/comparisons', {
      seekerChartId: 'chart_s',
      targetChartId: 'chart_t',
      relationshipMode: 'friends',
      createdBy: 'usr_owner',
    });
    const create2 = await request(srv.base, 'POST', '/api/comparisons', {
      seekerChartId: 'chart_s',
      targetChartId: 'chart_t',
      relationshipMode: 'friends',
      createdBy: 'usr_owner',
    });
    assert.equal(create1.status, 201);
    assert.equal(create2.status, 201);
    assert.equal(create1.body.planHash, create2.body.planHash);

    const list = await request(srv.base, 'GET', '/api/comparisons?userId=usr_owner', null);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.items));
    assert.ok(list.body.items.length >= 1);

    const getOne = await request(srv.base, 'GET', `/api/comparisons/${create1.body.id}`, null);
    assert.equal(getOne.status, 200);
    assert.equal(getOne.body.roles.seekerChartId, 'chart_s');
    assert.equal(getOne.body.roles.targetChartId, 'chart_t');
  } finally {
    await srv.close();
  }
  console.log('stage3-regression-smoke: PASS');
}

main().catch((e) => {
  console.error('stage3-regression-smoke: FAIL', e);
  process.exit(1);
});
