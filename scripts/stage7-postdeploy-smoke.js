/**
 * Stage 7 / Pre–Stage 8 cross-surface smoke (Render engine + optional Vercel).
 *
 * Usage:
 *   RENDER_BASE=https://....onrender.com \
 *   VERCEL_PREVIEW=https://....vercel.app \
 *   VERCEL_BYPASS_SECRET=... \
 *   node scripts/stage7-postdeploy-smoke.js
 *
 * Creates ephemeral profile/charts/relationship/group via public Stage 3/4 APIs (no DB URL required).
 *
 * Wiring model (report.wiringModel):
 * - Campaign = artifact consumer (intended); does NOT invoke composeAPI.
 * - Canonical transit for cross-surface checks = GET /api/chart-snapshot (same HTTP path fetchChartSnapshot uses).
 * - RPG daily audio GET = separate rail; not canonical Lyria/compose output.
 */

const crypto = require('crypto');

const assert = (cond, msg) => {
  if (!cond) {
    console.error('ASSERT FAIL:', msg);
    process.exit(1);
  }
};

const RENDER = (process.env.RENDER_BASE || 'https://astradio-mvp-archive.onrender.com').replace(/\/+$/, '');
const VERCEL_PREVIEW = (process.env.VERCEL_PREVIEW || '').replace(/\/+$/, '');
const VERCEL_BYPASS = process.env.VERCEL_BYPASS_SECRET || '';

/** Fixed transit (relationship forecast + sky parity). */
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

function parseIsoToDateTime(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  assert(m, `bad iso for chart-snapshot: ${iso}`);
  return { date: m[1], time: m[2] };
}

/**
 * Mirrors vnext/api/compose.ts ComposeAPI.hashSnapshot (canonical EphemerisSnapshot hash).
 */
function composeSnapshotSha256(snapshot) {
  const canonical = {
    ts: snapshot.ts,
    tz: snapshot.tz,
    lat: snapshot.lat,
    lon: snapshot.lon,
    houseSystem: snapshot.houseSystem,
    planets: snapshot.planets
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        name: p.name,
        lon: p.lon,
        lat: p.lat ?? null,
        speed: p.speed ?? null,
      })),
    houses: snapshot.houses,
    aspects: snapshot.aspects.slice().sort((a, b) => {
      const cmp = a.bodyA.localeCompare(b.bodyA);
      return cmp !== 0 ? cmp : a.bodyB.localeCompare(b.bodyB);
    }),
    moonPhase: snapshot.moonPhase,
    dominantElements: snapshot.dominantElements,
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

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

async function getChartSnapshot(base, date, time, lat, lon) {
  const q = new URLSearchParams({
    date,
    time,
    lat: String(lat),
    lon: String(lon),
  });
  const r = await fetch(`${base}/api/chart-snapshot?${q}`, { headers: { Accept: 'application/json' } });
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

function vercelHeaders(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (VERCEL_BYPASS) h['x-vercel-protection-bypass'] = VERCEL_BYPASS.trim();
  return h;
}

async function main() {
  const report = {
    render: RENDER,
    wiringModelVersion: 'pre_stage8_v1',
    wiringModel: {
      campaign: 'artifact_consumer_intended',
      canonicalTransitSource: 'GET /api/chart-snapshot (same chain as fetchChartSnapshot)',
      rpgDailyAudio: 'separate_rail_not_compose_output',
      classifications: {
        full_canonical_producer:
          'POST /api/compose snapshot lane; POST /api/compose overlay; POST /api/comparisons with composition; aggregate composite/forecast compose=1',
        partial_producer: 'GET /api/profile/chart explainer; forecast without compose=1; sandbox report',
        artifact_consumer: 'Stage 5 campaign (solo/group/auto); sandbox compositions persistence',
        divergent_or_legacy: 'POST /api/compositions/generate; conditional /api/render; scripts/smoke-test.js',
      },
    },
    tests: {},
  };

  console.log('[A] Health');
  const health = await j('GET', '/health');
  assert(health.status === 200, `health ${health.status}`);
  report.tests.health = { ok: true, status: health.status };

  if (VERCEL_PREVIEW && VERCEL_BYPASS) {
    console.log('[A2] Vercel preview /api/health (bypass)');
    const vr = await fetch(`${VERCEL_PREVIEW}/api/health`, {
      headers: vercelHeaders(),
    });
    const vb = await vr.text();
    assert(vr.ok, `vercel health ${vr.status} ${vb.slice(0, 200)}`);
    report.tests.vercel_health = { ok: true, status: vr.status };
  } else {
    report.tests.vercel_health = { skipped: true, reason: 'VERCEL_PREVIEW or VERCEL_BYPASS_SECRET unset' };
  }

  const transitDt = parseIsoToDateTime(TRANSIT.datetime);
  console.log('[A3] Canonical transit snapshot (engine GET /api/chart-snapshot)');
  const snapTransit = await getChartSnapshot(RENDER, transitDt.date, transitDt.time, TRANSIT.lat, TRANSIT.lon);
  assert(snapTransit.status === 200, `chart-snapshot ${snapTransit.status}`);
  const transitSnapshot = snapTransit.data;
  assert(
    transitSnapshot && typeof transitSnapshot === 'object' && Array.isArray(transitSnapshot.planets),
    'chart-snapshot body invalid'
  );
  const transitSnapshotSha = composeSnapshotSha256(transitSnapshot);
  report.tests.canonical_transit_snapshot = {
    date: transitDt.date,
    time: transitDt.time,
    lat: TRANSIT.lat,
    lon: TRANSIT.lon,
    composeSnapshotSha256: transitSnapshotSha,
  };

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
  assert(rf1.data.artifact == null, 'relationship forecast without compose must not include artifact');
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
  assert(gf1.data.artifact == null, 'group forecast without compose must not include artifact');
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
  report.tests.feed_to_artifact_relationship = {
    planHash: rfArt.data.artifact.planHash,
    template_id: rfArt.data.artifact?.text?.template_id,
    audioLen: (rfArt.data.artifact?.audioBase64 || '').length,
  };

  console.log('[F2] Group forecast compose=1 (aggregate path parity with pair)');
  const gfArt = await j('GET', fPathGrp(groupId, qsCompose));
  assert(gfArt.status === 200, `group compose forecast ${gfArt.status}`);
  assert(gfArt.data.artifact?.planHash, 'group missing artifact.planHash');
  report.tests.feed_to_artifact_group = {
    planHash: gfArt.data.artifact.planHash,
    template_id: gfArt.data.artifact?.text?.template_id,
    audioLen: (gfArt.data.artifact?.audioBase64 || '').length,
  };

  console.log('[G] Aggregate composite regression (no weather path)');
  const c1 = await j('GET', `/api/relationships/${encodeURIComponent(relId)}/composite?userId=${encodeURIComponent(ownerUserId)}`);
  const c2 = await j('GET', `/api/relationships/${encodeURIComponent(relId)}/composite?userId=${encodeURIComponent(ownerUserId)}`);
  assert(c1.status === 200 && c2.status === 200, `composite ${c1.status}`);
  assert(c1.data.artifact?.planHash === c2.data.artifact?.planHash, 'composite planHash unstable');
  report.tests.composite_regression = { planHash: c1.data.artifact.planHash };

  console.log('[G2] Group composite (persisted aggregate)');
  const gc1 = await j('GET', `/api/groups/${encodeURIComponent(groupId)}/composite?userId=${encodeURIComponent(ownerUserId)}`);
  assert(gc1.status === 200, `group composite ${gc1.status}`);
  assert(gc1.data.artifact?.planHash, 'group composite planHash');
  report.tests.group_composite = { planHash: gc1.data.artifact.planHash };

  console.log('[H] Sky compose + chart-snapshot hash parity');
  const sb = await j('POST', '/api/compose', {
    mode: 'sky',
    skyParams: {
      latitude: TRANSIT.lat,
      longitude: TRANSIT.lon,
      datetime: TRANSIT.datetime,
    },
  });
  assert(sb.status === 200, `sky compose ${sb.status} ${JSON.stringify(sb.data).slice(0, 200)}`);
  const provSha = sb.data?.artifacts?.provenance?.snapshot_sha256;
  assert(provSha, 'compose missing artifacts.provenance.snapshot_sha256');
  assert(
    provSha === transitSnapshotSha,
    `snapshot_sha256 mismatch: compose=${provSha} chart-snapshot=${transitSnapshotSha}`
  );
  report.tests.sky_compose = {
    ok: true,
    hasAudio: !!(sb.data.audio && sb.data.audio.base64),
    compose_kind: sb.data.compose_kind,
    snapshot_sha256_matches_chart_snapshot: true,
  };

  console.log('[H2] Profile explainer vs full compose (distinct paths)');
  const expl = await j('GET', `/api/profile/chart?chartId=${encodeURIComponent(chartA)}`);
  assert(expl.status === 200, `profile chart ${expl.status}`);
  assert(
    expl.data.explainer?.sections?.length > 0,
    'profile explainer should return sections'
  );
  assert(expl.data.audio == null && expl.data.compose_kind == null, 'explainer must not be full compose response');
  const natalSnap = await getChartSnapshot(RENDER, '1991-01-01', '09:30', 40.7128, -74.006);
  assert(natalSnap.status === 200, `natal chart-snapshot ${natalSnap.status}`);
  const natalFull = await j('POST', '/api/compose', {
    mode: 'sandbox',
    seed: `s7_natal_${chartA}`,
    overriddenSnapshot: natalSnap.data,
  });
  assert(natalFull.status === 200, `natal compose ${natalFull.status}`);
  assert(
    natalFull.data.compose_kind === 'snapshot_canonical',
    'natal full compose should be snapshot_canonical'
  );
  report.tests.profile_paths = {
    explainer_section_count: expl.data.explainer.sections.length,
    full_compose_kind: natalFull.data.compose_kind,
    full_compose_has_plan: !!(natalFull.data.hashes && natalFull.data.hashes.plan_sha256),
  };

  console.log('[H3] Overlay compose (canonical snapshot lane)');
  const ov = await j('POST', '/api/compose', {
    mode: 'overlay',
    overlayParams: {
      natalLatitude: 40.7128,
      natalLongitude: -74.006,
      natalDatetime: '1990-06-15T14:30:00Z',
      currentLatitude: TRANSIT.lat,
      currentLongitude: TRANSIT.lon,
      currentDatetime: TRANSIT.datetime,
    },
  });
  assert(ov.status === 200, `overlay compose ${ov.status}`);
  assert(ov.data.compose_kind === 'snapshot_canonical', 'overlay compose_kind');
  report.tests.overlay_compose = { compose_kind: ov.data.compose_kind, has_text: !!ov.data.text?.template_id };

  console.log('[H4] Comparison create (aggregate canonical lane)');
  const cmp = await j('POST', '/api/comparisons', {
    chartAId: chartA,
    chartBId: chartB,
    relationshipMode: 'friends',
    createdBy: ownerUserId,
  });
  assert(cmp.status === 201, `comparisons ${cmp.status}`);
  assert(cmp.data.planHash && cmp.data.planHash !== '__compose_skipped__', 'comparison planHash');
  report.tests.comparison_create = { planHash: cmp.data.planHash, compositionId: cmp.data.compositionId };

  if (VERCEL_PREVIEW && VERCEL_BYPASS) {
    console.log('[H5] Next/Vercel sky compose proxy parity (plan hash vs engine)');
    const skyClientBody = {
      date: transitDt.date,
      time: transitDt.time,
      location: {
        source: 'geofinder',
        label: 'S7 parity',
        lat: TRANSIT.lat,
        lon: TRANSIT.lon,
        timezone: 'UTC',
        resolvedAt: new Date().toISOString(),
      },
    };
    const vr = await fetch(`${VERCEL_PREVIEW}/api/compose`, {
      method: 'POST',
      headers: vercelHeaders(),
      body: JSON.stringify(skyClientBody),
    });
    const vtxt = await vr.text();
    let vdata = {};
    try {
      vdata = vtxt ? JSON.parse(vtxt) : {};
    } catch {
      vdata = {};
    }
    assert(vr.ok, `vercel compose ${vr.status} ${vtxt.slice(0, 300)}`);
    const enginePlan = sb.data.hashes?.plan_sha256;
    const vercelPlan = vdata.hashes?.plan_sha256;
    assert(enginePlan && vercelPlan, 'missing plan_sha256 for parity');
    assert(enginePlan === vercelPlan, `vercel vs engine plan_sha256 mismatch ${enginePlan} vs ${vercelPlan}`);
    report.tests.vercel_compose_proxy_parity = { ok: true, plan_sha256: enginePlan };
  } else {
    report.tests.vercel_compose_proxy_parity = { skipped: true };
  }

  console.log('[I] Stage 5 campaigns — consumer model (no composeAPI on campaign routes)');
  const campListBefore = await j('GET', `/api/campaigns?userId=${encodeURIComponent(ownerUserId)}`);
  assert(campListBefore.status === 200, `campaigns ${campListBefore.status}`);
  assert(Array.isArray(campListBefore.data.campaigns), 'campaigns array');

  const natalForSolo = await getChartSnapshot(RENDER, '1991-01-01', '09:30', 40.7128, -74.006);
  assert(natalForSolo.status === 200, 'natalForSolo');
  const campSolo = await j('POST', `/api/campaigns/create?userId=${encodeURIComponent(ownerUserId)}`, {
    mode: 'solo',
    natalSnapshot: natalForSolo.data,
  });
  assert(campSolo.status === 201 || campSolo.status === 200, `campaign solo ${campSolo.status}`);
  assert(
    Array.isArray(campSolo.data.participantChartIds) && campSolo.data.participantChartIds.includes(chartA),
    'solo campaign should bind owner primary chart'
  );
  assert(
    campSolo.data.compositeArtifactId == null,
    'solo campaign must not require compositeArtifactId'
  );
  report.tests.campaign_solo_consumer = {
    campaignId: campSolo.data.campaignId,
    mode: campSolo.data.mode,
    participantChartIds: campSolo.data.participantChartIds,
    compositeArtifactId: campSolo.data.compositeArtifactId,
    classification: 'artifact_consumer_intended',
  };

  const campGroup = await j('POST', `/api/campaigns/create?userId=${encodeURIComponent(ownerUserId)}`, {
    mode: 'group',
    groupId,
  });
  assert(campGroup.status === 201 || campGroup.status === 200, `campaign group ${campGroup.status}`);
  assert(campGroup.data.compositeArtifactId, 'group campaign must reference compositeArtifactId');
  assert(
    campGroup.data.groupId === groupId,
    'campaign.groupId should match relational group'
  );
  report.tests.campaign_group_consumer = {
    campaignId: campGroup.data.campaignId,
    compositeArtifactId: campGroup.data.compositeArtifactId,
    groupId: campGroup.data.groupId,
    participantChartIds: campGroup.data.participantChartIds,
    classification: 'artifact_consumer_intended',
  };

  console.log('[I2] Group campaign without composite must fail (422)');
  const groupBare = await j('POST', `/api/groups?userId=${encodeURIComponent(ownerUserId)}`, {
    name: `S7 Bare ${Date.now()}`,
    description: 'no composite',
  });
  assert(groupBare.status === 201, 'groupBare');
  const bareId = groupBare.data.id;
  assert(
    (await j('POST', `/api/groups/${bareId}/members?userId=${encodeURIComponent(ownerUserId)}`, { chartId: chartA }))
      .status === 201,
    'bare m1'
  );
  assert(
    (await j('POST', `/api/groups/${bareId}/members?userId=${encodeURIComponent(ownerUserId)}`, { chartId: chartB }))
      .status === 201,
    'bare m2'
  );
  const campBare = await j('POST', `/api/campaigns/create?userId=${encodeURIComponent(ownerUserId)}`, {
    mode: 'group',
    groupId: bareId,
  });
  assert(campBare.status === 422, `expected 422 without composite, got ${campBare.status}`);
  report.tests.campaign_group_requires_composite = { status: campBare.status, ok: true };

  const campList = await j('GET', `/api/campaigns?userId=${encodeURIComponent(ownerUserId)}`);
  assert(campList.status === 200, `campaigns ${campList.status}`);
  report.tests.campaigns_list = { count: campList.data.campaigns.length };

  if (VERCEL_PREVIEW && VERCEL_BYPASS && campGroup.data.campaignId) {
    console.log('[I3] RPG daily turn — canonical transit snapshot + determinism (Next API)');
    const cid = campGroup.data.campaignId;
    const r1 = await fetch(`${VERCEL_PREVIEW}/api/rpg/campaign/${encodeURIComponent(cid)}/turn`, {
      method: 'POST',
      headers: vercelHeaders(),
      body: JSON.stringify({ transitSnapshot }),
    });
    const t1txt = await r1.text();
    let t1 = {};
    try {
      t1 = t1txt ? JSON.parse(t1txt) : {};
    } catch {
      t1 = {};
    }
    if (!r1.ok) {
      report.tests.rpg_turn_determinism = {
        skipped: true,
        status: r1.status,
        reason: String(t1.error || t1txt || '').slice(0, 240),
        hint: 'Vercel must share Postgres with engine for stage5_campaigns row to exist on Next',
      };
      report.tests.rpg_audio_separate_rail = { skipped: true, reason: 'rpg turn prerequisite failed' };
    } else {
      assert(t1.transit_snapshot_hash, 'turn missing transit_snapshot_hash');
      const r2 = await fetch(`${VERCEL_PREVIEW}/api/rpg/campaign/${encodeURIComponent(cid)}/turn`, {
        method: 'POST',
        headers: vercelHeaders(),
        body: JSON.stringify({ transitSnapshot }),
      });
      const t2 = await r2.json().catch(() => ({}));
      assert(r2.ok, `rpg turn repeat ${r2.status}`);
      assert(t1.turn_seed === t2.turn_seed && t1.id === t2.id, 'rpg turn not idempotent for same transit+state');
      report.tests.rpg_turn_determinism = {
        turn_id: t1.id,
        turn_seed: t1.turn_seed,
        transit_snapshot_hash: t1.transit_snapshot_hash,
        note: 'RPG uses vnext/rpg/hash/snapshot-hash (snapshot: prefix); compose uses composeAPI.hashSnapshot — different digests for same ephemeris',
      };

      console.log('[I4] RPG daily audio rail — not treated as compose output');
      const au = await fetch(`${VERCEL_PREVIEW}/api/rpg/turn/${encodeURIComponent(t1.id)}/audio`, {
        headers: vercelHeaders({ Accept: 'application/json' }),
      });
      const aud = await au.json().catch(() => ({}));
      assert(au.ok, `rpg audio ${au.status}`);
      assert(aud.status === 'pending', `expected RPG audio row status=pending, got ${aud.status}`);
      assert(
        !aud.compose_kind && !aud.hashes?.plan_sha256,
        'rpg audio response must not mimic compose payload'
      );
      report.tests.rpg_audio_separate_rail = {
        status: aud.status,
        provider: aud.provider,
        note: 'GET audio documents pending row; not canonical Lyria/compose output',
      };
    }
  } else {
    report.tests.rpg_turn_determinism = {
      skipped: true,
      reason: 'VERCEL_PREVIEW/BYPASS or campaignId missing — shared DB required for Next RPG routes',
    };
    report.tests.rpg_audio_separate_rail = { skipped: true };
  }

  console.log('\n=== STAGE7/8 PRE-SMOKE HARNESS PASSED (local run) ===\n');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
