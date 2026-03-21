/**
 * Stage 7 post-deploy smoke (Render engine + optional Vercel health).
 * Usage:
 *   RENDER_BASE=https://astradio-mvp-archive.onrender.com \
 *   VERCEL_PREVIEW=https://....vercel.app \
 *   VERCEL_BYPASS_SECRET=... \
 *   node scripts/stage7-postdeploy-smoke.js
 *
 * Creates ephemeral profile/charts/relationship/group via public Stage 3/4 APIs (no DB URL required).
 */

const assert = (cond, msg) => {
  if (!cond) {
    console.error('ASSERT FAIL:', msg);
    process.exit(1);
  }
};

const RENDER = (process.env.RENDER_BASE || 'https://astradio-mvp-archive.onrender.com').replace(/\/+$/, '');
const VERCEL_PREVIEW = (process.env.VERCEL_PREVIEW || '').replace(/\/+$/, '');
const VERCEL_BYPASS = process.env.VERCEL_BYPASS_SECRET || '';

const TRANSIT = {
  datetime: '2025-06-15T18:00:00Z',
  lat: 40.7128,
  lon: -74.006,
  tz: 'UTC',
};
const TRANSIT_B = {
  datetime: '2025-06-16T06:30:00Z',
  lat: 40.7128,
  lon: -74.006,
  tz: 'UTC',
};

async function j(method, path, body, base = RENDER) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
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

function forecastQs(userId, extra = {}) {
  const p = new URLSearchParams({
    userId,
    transitDatetime: extra.transitDatetime || TRANSIT.datetime,
    transitLatitude: String(extra.transitLatitude ?? TRANSIT.lat),
    transitLongitude: String(extra.transitLongitude ?? TRANSIT.lon),
    transitTimezone: extra.transitTimezone || TRANSIT.tz,
    ...extra,
  });
  return p.toString();
}

async function main() {
  const report = { render: RENDER, tests: {} };

  console.log('[A] Health');
  const health = await j('GET', '/health');
  assert(health.status === 200, `health ${health.status}`);
  report.tests.health = { ok: true, status: health.status };

  if (VERCEL_PREVIEW && VERCEL_BYPASS) {
    console.log('[A2] Vercel preview /api/health (bypass)');
    const vr = await fetch(`${VERCEL_PREVIEW}/api/health`, {
      headers: { 'x-vercel-protection-bypass': VERCEL_BYPASS.trim() },
    });
    const vb = await vr.text();
    assert(vr.ok, `vercel health ${vr.status} ${vb.slice(0, 200)}`);
    report.tests.vercel_health = { ok: true, status: vr.status };
  } else {
    report.tests.vercel_health = { skipped: true };
  }

  console.log('[Setup] Profile + charts + relationship + group');
  const ownerProfile = await j('POST', '/api/profile', {
    displayName: `Stage7Smoke ${Date.now()}`,
    chart: {
      label: 'S7 A',
      date: '1991-01-01',
      time: '09:30',
      lat: 40.7128,
      lon: -74.006,
      timezone: 'America/New_York',
    },
  });
  assert(ownerProfile.status === 201, `profile ${ownerProfile.status}`);
  const ownerUserId = ownerProfile.data.user.id;
  const chartA = ownerProfile.data.primaryChart.id;

  const chartBResp = await j('POST', '/api/charts', {
    ownerId: ownerUserId,
    label: 'S7 B',
    date: '1992-02-02',
    time: '13:15',
    lat: 34.0522,
    lon: -118.2437,
    timezone: 'America/Los_Angeles',
  });
  assert(chartBResp.status === 201, `chartB ${chartBResp.status}`);
  const chartB = chartBResp.data.id;

  const relCreate = await j(
    'POST',
    `/api/relationships?userId=${encodeURIComponent(ownerUserId)}`,
    { chartAId: chartA, chartBId: chartB, label: 's7-smoke' }
  );
  assert(relCreate.status === 201, `relationship ${relCreate.status}`);
  const relId = relCreate.data.id;

  const groupCreate = await j('POST', `/api/groups?userId=${encodeURIComponent(ownerUserId)}`, {
    name: `S7 Group ${Date.now()}`,
    description: 'stage7 smoke',
  });
  assert(groupCreate.status === 201, `group ${groupCreate.status}`);
  const groupId = groupCreate.data.id;
  assert(
    (await j('POST', `/api/groups/${groupId}/members?userId=${encodeURIComponent(ownerUserId)}`, { chartId: chartA }))
      .status === 201,
    'add m1'
  );
  assert(
    (await j('POST', `/api/groups/${groupId}/members?userId=${encodeURIComponent(ownerUserId)}`, { chartId: chartB }))
      .status === 201,
    'add m2'
  );

  const fPathRel = (id, qs) => `/api/relationships/${encodeURIComponent(id)}/forecast?${qs}`;
  const fPathGrp = (id, qs) => `/api/groups/${encodeURIComponent(id)}/forecast?${qs}`;

  console.log('[B] Relationship forecast determinism (x2)');
  const qs1 = forecastQs(ownerUserId);
  const rf1 = await j('GET', fPathRel(relId, qs1));
  const rf2 = await j('GET', fPathRel(relId, qs1));
  assert(rf1.status === 200 && rf2.status === 200, `rel forecast ${rf1.status} ${rf2.status}`);
  assert(rf1.data.weather?.stateHash === rf2.data.weather?.stateHash, 'rel stateHash drift');
  assert(
    rf1.data.weather?.score?.significance === rf2.data.weather?.score?.significance,
    'rel significance drift'
  );
  report.tests.rel_forecast_determinism = {
    stateHash: rf1.data.weather.stateHash,
    significance: rf1.data.weather.score.significance,
    raw: rf1.data.weather.score.raw,
  };

  console.log('[C] Group forecast determinism (x2)');
  const gf1 = await j('GET', fPathGrp(groupId, qs1));
  const gf2 = await j('GET', fPathGrp(groupId, qs1));
  assert(gf1.status === 200 && gf2.status === 200, `grp forecast ${gf1.status} ${gf2.status}`);
  assert(gf1.data.weather?.stateHash === gf2.data.weather?.stateHash, 'grp stateHash drift');
  report.tests.group_forecast_determinism = {
    stateHash: gf1.data.weather.stateHash,
    significance: gf1.data.weather.score.significance,
  };

  console.log('[D] Transit sensitivity (relationship)');
  const qsAlt = forecastQs(ownerUserId, { transitDatetime: TRANSIT_B.datetime });
  const rfAlt = await j('GET', fPathRel(relId, qsAlt));
  assert(rfAlt.status === 200, `rel alt ${rfAlt.status}`);
  assert(rfAlt.data.weather?.stateHash !== rf1.data.weather?.stateHash, 'transit change should change stateHash');
  report.tests.transit_sensitivity = {
    baseHash: rf1.data.weather.stateHash.slice(0, 16),
    altHash: rfAlt.data.weather.stateHash.slice(0, 16),
  };

  console.log('[E] Pair vs group comparability (same transit)');
  report.tests.pair_vs_group = {
    pair_sig: rf1.data.weather.score.significance,
    group_sig: gf1.data.weather.score.significance,
    pair_raw: rf1.data.weather.score.raw,
    group_raw: gf1.data.weather.score.raw,
  };

  console.log('[F] Feed-to-artifact compose=1 (relationship)');
  const qsCompose = forecastQs(ownerUserId, { compose: '1' });
  const rfArt = await j('GET', fPathRel(relId, qsCompose));
  assert(rfArt.status === 200, `compose forecast ${rfArt.status}`);
  assert(rfArt.data.artifact?.planHash, 'missing artifact.planHash');
  const longText = rfArt.data.artifact?.text?.long || '';
  assert(
    longText.includes('Relational field') || longText.includes('relational'),
    'artifact text should include relational weather annex'
  );
  report.tests.feed_to_artifact = {
    planHash: rfArt.data.artifact.planHash,
    template_id: rfArt.data.artifact?.text?.template_id,
    audioLen: (rfArt.data.artifact?.audioBase64 || '').length,
  };

  console.log('[G] Aggregate composite regression (no weather path)');
  const c1 = await j('GET', `/api/relationships/${encodeURIComponent(relId)}/composite?userId=${encodeURIComponent(ownerUserId)}`);
  const c2 = await j('GET', `/api/relationships/${encodeURIComponent(relId)}/composite?userId=${encodeURIComponent(ownerUserId)}`);
  assert(c1.status === 200 && c2.status === 200, `composite ${c1.status}`);
  assert(c1.data.artifact?.planHash === c2.data.artifact?.planHash, 'composite planHash unstable');
  report.tests.composite_regression = { planHash: c1.data.artifact.planHash };

  console.log('[H] Sky compose regression (Stage 6-adjacent canonical path)');
  const sb = await j('POST', '/api/compose', {
    mode: 'sky',
    skyParams: {
      latitude: 40.7128,
      longitude: -74.006,
      datetime: '2025-06-15T18:00:00Z',
    },
  });
  assert(sb.status === 200, `sky compose ${sb.status} ${JSON.stringify(sb.data).slice(0, 200)}`);
  report.tests.sky_compose = { ok: true, hasAudio: !!(sb.data.audio && sb.data.audio.base64) };

  console.log('[I] Stage 5 campaigns list');
  const camp = await j('GET', `/api/campaigns?userId=${encodeURIComponent(ownerUserId)}`);
  assert(camp.status === 200, `campaigns ${camp.status}`);
  assert(Array.isArray(camp.data.campaigns), 'campaigns array');
  report.tests.campaigns = { count: camp.data.campaigns.length };

  console.log('\n=== STAGE7 POST-DEPLOY SMOKE PASSED ===\n');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
