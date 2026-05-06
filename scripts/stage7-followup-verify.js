/**
 * Stage 7 post-deploy follow-up: weather depth, multi-member comparability, ranking sample.
 * Run: RENDER_BASE=... node scripts/stage7-followup-verify.js
 * Optional: VERCEL_PREVIEW + VERCEL_BYPASS_SECRET for health only.
 */

const RENDER = (process.env.RENDER_BASE || 'https://astradio-mvp-archive.onrender.com').replace(/\/+$/, '');

const TRANSIT = {
  datetime: '2025-08-01T12:00:00Z',
  lat: 51.5074,
  lon: -0.1278,
  tz: 'UTC',
};

async function j(method, path, body) {
  const r = await fetch(`${RENDER}${path}`, {
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

function qsForecast(userId, extra = {}) {
  const p = new URLSearchParams({
    userId,
    transitDatetime: extra.transitDatetime || TRANSIT.datetime,
    transitLatitude: String(extra.transitLatitude ?? TRANSIT.lat),
    transitLongitude: String(extra.transitLongitude ?? TRANSIT.lon),
    transitTimezone: extra.transitTimezone || TRANSIT.tz,
  });
  if (extra.compose) p.set('compose', '1');
  return p.toString();
}

function textFingerprint(t) {
  if (!t || typeof t !== 'object') return { len: 0, hash: null };
  const long = String(t.long || '');
  const short = String(t.short || '');
  let h = 0;
  for (let i = 0; i < long.length; i++) h = (h * 31 + long.charCodeAt(i)) >>> 0;
  return { len: long.length, shortLen: short.length, fp: h };
}

function sumAspectCounts(w) {
  const c = w?.aspects?.counts;
  if (!c) return null;
  return (
    (c.supportive || 0) +
    (c.flowing || 0) +
    (c.tense || 0) +
    (c.polarizing || 0) +
    (c.amplifying || 0)
  );
}

(async () => {
  const out = {
    render_commit_probe: null,
    fixtures_weather_depth: [],
    larger_groups: [],
    ranking_sample: [],
    regression: {},
  };

  const h = await j('GET', '/health');
  out.render_commit_probe = h.data;

  console.log('Provisioning 4 charts + bindings...');
  const prof = await j('POST', '/api/profile', {
    displayName: `S7FU ${Date.now()}`,
    chart: {
      label: 'C1',
      date: '1990-01-15',
      time: '10:00',
      lat: 51.5,
      lon: -0.12,
      timezone: 'Europe/London',
    },
  });
  if (prof.status !== 201) {
    console.error('profile fail', prof);
    process.exit(1);
  }
  const uid = prof.data.user.id;
  const c1 = prof.data.primaryChart.id;

  const mkChart = async (label, date) => {
    const r = await j('POST', '/api/charts', {
      ownerId: uid,
      label,
      date,
      time: '14:30',
      lat: 48.85,
      lon: 2.35,
      timezone: 'Europe/Paris',
    });
    return r.data.id;
  };
  const c2 = await mkChart('C2', '1991-03-20');
  const c3 = await mkChart('C3', '1992-07-08');
  const c4 = await mkChart('C4', '1993-11-22');

  const rel = async (a, b, label) => {
    const r = await j('POST', `/api/relationships?userId=${encodeURIComponent(uid)}`, {
      chartAId: a,
      chartBId: b,
      label,
    });
    return r.data.id;
  };
  const r1 = await rel(c1, c2, 'fu-pair-ab');
  const r2 = await rel(c3, c4, 'fu-pair-cd');
  const r3 = await rel(c1, c3, 'fu-pair-ac');

  const mkGroup = async (name, chartIds) => {
    const g = await j('POST', `/api/groups?userId=${encodeURIComponent(uid)}`, {
      name,
      description: 's7 followup',
    });
    const gid = g.data.id;
    for (const cid of chartIds) {
      const m = await j('POST', `/api/groups/${gid}/members?userId=${encodeURIComponent(uid)}`, {
        chartId: cid,
      });
      if (m.status !== 201) throw new Error(`member ${cid} ${m.status}`);
    }
    return gid;
  };
  const g2 = await mkGroup(`FUg2 ${Date.now()}`, [c1, c2]);
  const g3 = await mkGroup(`FUg3 ${Date.now()}`, [c1, c2, c3]);
  const g4 = await mkGroup(`FUg4 ${Date.now()}`, [c1, c2, c3, c4]);

  const runFixture = async (name, type, id, chartIds) => {
    const base =
      type === 'pair' ? `/api/relationships/${encodeURIComponent(id)}` : `/api/groups/${encodeURIComponent(id)}`;
    const comp = await j('GET', `${base}/composite?userId=${encodeURIComponent(uid)}`);
    const qW = qsForecast(uid, { compose: '1' });
    const wx = await j('GET', `${base}/forecast?${qW}`);

    const nwPlan = comp.data?.artifact?.planHash;
    const wPlan = wx.data?.artifact?.planHash;
    const wTpl = wx.data?.artifact?.text?.template_id;
    const wText = wx.data?.artifact?.text;
    const wAudioLen = (wx.data?.artifact?.audioBase64 || '').length;
    const wAudioSha = wx.data?.artifact?.audio?.sha256 || wx.data?.hashes?.audio || null;

    const phaseDSurface = wx.data?.artifact?.text?.explanation?.meta?.phase_d?.surface ?? null;

    out.fixtures_weather_depth.push({
      name,
      type,
      bindingId: id,
      chartIds,
      transit: TRANSIT,
      non_weather: {
        path: `${type} GET .../composite (runner without relationalWeather; JSON has planHash only)`,
        planHash: nwPlan,
        composite_status: comp.status,
        note: 'Stage 4 composite response does not include text/audio payloads.',
      },
      weather_compose: {
        path: `${type} GET .../forecast?compose=1`,
        stateHash: wx.data?.weather?.stateHash,
        planHash: wPlan,
        template_id: wTpl,
        text_fp: textFingerprint(wText),
        audioBase64Len: wAudioLen,
        audio_sha256: wAudioSha,
        phase_d_surface: phaseDSurface,
      },
      planHash_equal: nwPlan === wPlan,
    });
  };

  await runFixture('pair_AB', 'pair', r1, [c1, c2]);
  await runFixture('pair_CD', 'pair', r2, [c3, c4]);
  await runFixture('pair_AC', 'pair', r3, [c1, c3]);
  await runFixture('group_2', 'group', g2, [c1, c2]);
  await runFixture('group_3', 'group', g3, [c1, c2, c3]);
  await runFixture('group_4', 'group', g4, [c1, c2, c3, c4]);

  const weatherOnly = async (type, id) => {
    const path =
      type === 'pair'
        ? `/api/relationships/${encodeURIComponent(id)}/forecast?${qsForecast(uid)}`
        : `/api/groups/${encodeURIComponent(id)}/forecast?${qsForecast(uid)}`;
    const r = await j('GET', path);
    const w = r.data?.weather;
    return {
      type,
      id,
      stateHash: w?.stateHash,
      raw: w?.score?.raw,
      significance: w?.score?.significance,
      activation: w?.activation,
      aspectHitsTotal: sumAspectCounts(w),
      topThemes: w?.themes?.dominantThemes || [],
    };
  };

  out.larger_groups.push(await weatherOnly('pair', r1));
  out.larger_groups.push(await weatherOnly('group', g2));
  out.larger_groups.push(await weatherOnly('group', g3));
  out.larger_groups.push(await weatherOnly('group', g4));

  const rankItems = [
    { kind: 'pair', bindingId: r1, label: 'pair_AB' },
    { kind: 'pair', bindingId: r2, label: 'pair_CD' },
    { kind: 'pair', bindingId: r3, label: 'pair_AC' },
    { kind: 'group', bindingId: g2, label: 'group_2' },
    { kind: 'group', bindingId: g3, label: 'group_3' },
    { kind: 'group', bindingId: g4, label: 'group_4' },
  ];

  for (const item of rankItems) {
    const path =
      item.kind === 'pair'
        ? `/api/relationships/${encodeURIComponent(item.bindingId)}/forecast?${qsForecast(uid)}`
        : `/api/groups/${encodeURIComponent(item.bindingId)}/forecast?${qsForecast(uid)}`;
    const r = await j('GET', path);
    const w = r.data?.weather;
    out.ranking_sample.push({
      kind: item.kind,
      bindingId: item.bindingId,
      label: item.label,
      significance: w?.score?.significance,
      raw: w?.score?.raw,
      themes: w?.themes?.dominantThemes || [],
    });
  }
  out.ranking_sample.sort((a, b) => (b.significance || 0) - (a.significance || 0));

  const cA = await j(
    'GET',
    `/api/relationships/${encodeURIComponent(r1)}/composite?userId=${encodeURIComponent(uid)}`
  );
  const cB = await j(
    'GET',
    `/api/relationships/${encodeURIComponent(r1)}/composite?userId=${encodeURIComponent(uid)}`
  );
  out.regression.aggregate_stable =
    cA.status === 200 &&
    cB.status === 200 &&
    cA.data?.artifact?.planHash === cB.data?.artifact?.planHash;

  const sky = await j('POST', '/api/compose', {
    mode: 'sky',
    skyParams: { latitude: TRANSIT.lat, longitude: TRANSIT.lon, datetime: TRANSIT.datetime },
  });
  out.regression.sky_compose_ok = sky.status === 200 && !!(sky.data?.audio?.base64);

  const camp = await j('GET', `/api/campaigns?userId=${encodeURIComponent(uid)}`);
  out.regression.campaigns_ok = camp.status === 200 && Array.isArray(camp.data?.campaigns);

  const composeRows = out.fixtures_weather_depth.filter((f) => f.weather_compose?.planHash);
  const pairSurfaces = composeRows.filter((f) => f.type === 'pair').map((f) => f.weather_compose.phase_d_surface);
  const groupSurfaces = composeRows.filter((f) => f.type === 'group').map((f) => f.weather_compose.phase_d_surface);
  out.regression.phase6d_pair_forecast_surface_compat_pair =
    pairSurfaces.length > 0 && pairSurfaces.every((s) => s === 'compat_pair');
  out.regression.phase6d_group_forecast_surface_group =
    groupSurfaces.length > 0 && groupSurfaces.every((s) => s === 'group');
  if (!out.regression.phase6d_pair_forecast_surface_compat_pair) {
    console.error(
      '[stage7-followup-verify] Phase 6D regression: pair compose forecast expected explanation.meta.phase_d.surface compat_pair',
      pairSurfaces
    );
    process.exit(1);
  }
  if (!out.regression.phase6d_group_forecast_surface_group) {
    console.error(
      '[stage7-followup-verify] Phase 6D regression: group compose forecast expected explanation.meta.phase_d.surface group',
      groupSurfaces
    );
    process.exit(1);
  }

  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
