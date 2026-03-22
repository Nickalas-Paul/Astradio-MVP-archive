/**
 * Phase 8 Community — live smoke against Vercel preview + Render engine.
 *
 * Env (required):
 *   VERCEL_PREVIEW_URL   e.g. https://....vercel.app
 *   VERCEL_BYPASS_TOKEN  x-vercel-protection-bypass value
 *
 * Env (optional):
 *   RENDER_URL           default https://astradio-mvp-archive.onrender.com
 *   DATABASE_URL         postgresql://... for read-only migration sanity (no secrets logged)
 *
 * Exits 0 if all critical steps pass; prints JSON summary to stdout.
 */

const VERCEL = (process.env.VERCEL_PREVIEW_URL || '').replace(/\/+$/, '');
const BYPASS = (process.env.VERCEL_BYPASS_TOKEN || '').trim();
const RENDER = (process.env.RENDER_URL || 'https://astradio-mvp-archive.onrender.com').replace(/\/+$/, '');
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();

const report = { ok: true, steps: [], meta: { vercelHost: VERCEL ? new URL(VERCEL).host : null } };

function step(name, passed, detail) {
  report.steps.push({ name, pass: !!passed, ...detail });
  if (!passed) report.ok = false;
}

function bypassHeaders(extra = {}) {
  return {
    'x-vercel-protection-bypass': BYPASS,
    ...extra,
  };
}

function jarCookie(res) {
  const getSetCookie = res.headers.getSetCookie?.bind(res.headers);
  const list = typeof getSetCookie === 'function' ? getSetCookie() : [];
  const firstParts = list.length
    ? list.map((c) => c.split(';')[0].trim())
    : (res.headers.get('set-cookie') || '')
        .split(/,(?=[^;]+?=)/)
        .map((s) => s.trim().split(';')[0].trim())
        .filter(Boolean);
  const session = firstParts.filter(
    (c) => c.startsWith('astradio_session=') || c.startsWith('__Secure-astradio_session=')
  );
  if (session.length) return session.join('; ');
  return firstParts.join('; ');
}

async function vfetch(path, opts = {}) {
  const url = `${VERCEL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = bypassHeaders({
    Accept: 'application/json',
    ...(opts.headers || {}),
  });
  const r = await fetch(url, { ...opts, headers });
  let data = {};
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      data = await r.json();
    } catch {
      data = {};
    }
  } else if (opts.parseText) {
    data = { _text: await r.text() };
  } else {
    try {
      data = await r.json();
    } catch {
      data = {};
    }
  }
  return { status: r.status, data, headers: r.headers, jar: jarCookie(r) };
}

async function main() {
  if (!VERCEL || !BYPASS) {
    console.error('Missing VERCEL_PREVIEW_URL or VERCEL_BYPASS_TOKEN');
    process.exit(2);
  }

  const ts = Date.now();
  const tagA = `SMK_A_${ts}`;
  const tagB = `SMK_B_${ts}`;

  // --- Render direct health ---
  try {
    const rh = await fetch(`${RENDER}/health`);
    step('render_health', rh.ok, { status: rh.status });
  } catch (e) {
    step('render_health', false, { error: String(e && e.message) });
  }

  // --- DB migration sanity (optional) ---
  if (DATABASE_URL) {
    try {
      const pg = require('pg');
      const c = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await c.connect();
      const q = await c.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'astradio_connection_intents'
         AND column_name IN ('from_chart_id','to_chart_id','accepted_at')`
      );
      await c.end();
      const cols = q.rows.map((r) => r.column_name).sort();
      step(
        'db_migration_intent_columns',
        cols.includes('from_chart_id') && cols.includes('to_chart_id') && cols.includes('accepted_at'),
        { columnsFound: cols }
      );
      const c2 = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await c2.connect();
      const t = await c2.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'astradio_relational_group_invites'
         ) AS exists`
      );
      await c2.end();
      step('db_migration_group_invites_table', !!t.rows[0]?.exists, {});
    } catch (e) {
      step('db_migration_check', false, { error: String(e && e.message) });
    }
  } else {
    step('db_migration_check', true, { skipped: true, reason: 'DATABASE_URL not set' });
  }

  // --- Community page HTML ---
  try {
    const r = await fetch(`${VERCEL}/community`, { headers: bypassHeaders({ Accept: 'text/html' }) });
    const text = await r.text();
    const hasCommunity = /Community|Discovery|Saved connections/i.test(text);
    step('community_page_loads', r.ok && hasCommunity, { status: r.status, hasExpectedCopy: hasCommunity });
  } catch (e) {
    step('community_page_loads', false, { error: String(e && e.message) });
  }

  // --- API health ---
  const ah = await vfetch('/api/health');
  step('vercel_api_health', ah.status === 200, { status: ah.status });

  const ch = await vfetch('/api/compat/health');
  step('compat_health', ch.status === 200, { status: ch.status });

  // --- Two isolated sessions ---
  const pa = await vfetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: tagA,
      chart: {
        label: 'Smoke A',
        date: '1991-01-01',
        time: '09:30',
        lat: 40.7128,
        lon: -74.006,
        timezone: 'America/New_York',
      },
    }),
  });
  step('profile_create_user_a', pa.status === 201 && pa.data?.user?.id && pa.data?.primaryChart?.id, {
    status: pa.status,
  });
  if (!pa.jar || pa.status !== 201) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  const cookieA = pa.jar;
  const userA = pa.data.user.id;
  const chartA = pa.data.primaryChart.id;

  const pb = await vfetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: tagB,
      chart: {
        label: 'Smoke B',
        date: '1992-02-02',
        time: '13:15',
        lat: 34.0522,
        lon: -118.2437,
        timezone: 'America/Los_Angeles',
      },
    }),
  });
  step('profile_create_user_b', pb.status === 201 && pb.data?.user?.id && pb.data?.primaryChart?.id, {
    status: pb.status,
  });
  if (!pb.jar || pb.status !== 201) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
  const cookieB = pb.jar;
  const userB = pb.data.user.id;
  const chartB = pb.data.primaryChart.id;

  // --- Compatibility discovery (matches) ---
  const matches = await vfetch(`/api/compat/matches?chartId=${encodeURIComponent(chartA)}&mode=friend&limit=5`);
  step(
    'compat_matches_discovery',
    matches.status === 200 && Array.isArray(matches.data?.matches),
    { status: matches.status, matchCount: matches.data?.matches?.length ?? null }
  );

  // --- Compatibility intent cluster API ---
  const intent = await vfetch('/api/compatibility/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', },
    body: JSON.stringify({
      seekerChartId: chartA,
      intent: 'friendship',
      limit: 5,
    }),
  });
  step(
    'compatibility_intent_flow',
    intent.status >= 200 && intent.status < 500,
    { status: intent.status, hasPayload: intent.data && Object.keys(intent.data).length > 0 }
  );

  // --- Directory search (broad) ---
  const searchDemo = await vfetch('/api/community/search?q=Demo&limit=10');
  step(
    'community_search',
    searchDemo.status === 200 && Array.isArray(searchDemo.data?.users),
    { status: searchDemo.status, userCount: searchDemo.data?.users?.length ?? null }
  );

  // --- Connect intent (A -> B) ---
  const ci = await vfetch('/api/community/connect-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({
      toUserId: userB,
      fromChartId: chartA,
      toChartId: chartB,
      label: 'Smoke',
    }),
  });
  step(
    'connect_intent_create',
    ci.status === 201 && ci.data?.id,
    { status: ci.status, error: ci.data?.error }
  );
  const intentId = ci.data?.id;

  const invB0 = await vfetch('/api/community/inventory', { headers: { Cookie: cookieB } });
  const pendingIn = invB0.data?.pendingIncomingIntents || [];
  step(
    'inventory_pending_incoming_for_b',
    invB0.status === 200 && pendingIn.some((p) => String(p.id) === String(intentId)),
    { status: invB0.status, pendingCount: pendingIn.length }
  );

  // --- Accept connection ---
  let acceptStatus = 0;
  if (intentId) {
    const acc = await vfetch(`/api/community/connection-intents/${encodeURIComponent(intentId)}/accept`, {
      method: 'POST',
      headers: { Cookie: cookieB },
    });
    acceptStatus = acc.status;
    step('connection_accept', acc.status === 200, { status: acc.status, error: acc.data?.error });
  } else {
    step('connection_accept', false, { error: 'no_intent_id' });
  }

  const invA = await vfetch('/api/community/inventory', { headers: { Cookie: cookieA } });
  const pairsA = invA.data?.pairs || [];
  const relId = pairsA.find((p) => p.peerUserId === userB || String(p.peerUserId) === String(userB))?.id;
  step(
    'inventory_pair_for_a_after_accept',
    invA.status === 200 && !!relId,
    { status: invA.status, pairCount: pairsA.length }
  );

  const invB1 = await vfetch('/api/community/inventory', { headers: { Cookie: cookieB } });
  const pairsB = invB1.data?.pairs || [];
  step(
    'inventory_pair_for_b_after_accept',
    invB1.status === 200 && pairsB.length >= 1,
    { status: invB1.status, pairCount: pairsB.length }
  );

  // --- Inventory not demo / contract shape ---
  step(
    'inventory_contract_v1',
    invA.status === 200 && invA.data?.version === 'community_inventory_v1' && Array.isArray(invA.data?.feedSkeleton),
    { version: invA.data?.version, feedSkeletonLen: invA.data?.feedSkeleton?.length }
  );

  // --- Relational weather on accepted pair ---
  if (relId) {
    const qs = new URLSearchParams({
      transitDatetime: new Date().toISOString(),
      transitLatitude: '0',
      transitLongitude: '0',
      transitTimezone: 'UTC',
    });
    const fc = await vfetch(`/api/relationships/${encodeURIComponent(relId)}/forecast?${qs}`, {
      headers: { Cookie: cookieA },
    });
    step(
      'relational_weather_forecast',
      fc.status === 200 && (fc.data?.feedItem != null || fc.data?.weather != null),
      { status: fc.status, keys: fc.data && Object.keys(fc.data).slice(0, 8) }
    );
  } else {
    step('relational_weather_forecast', false, { error: 'no_relationship_id' });
  }

  // --- User-created relational group + invite + accept ---
  const slug = `smk_${ts.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const grp = await vfetch('/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: JSON.stringify({
      name: `Smoke Group ${ts}`,
      slug,
      description: 'live smoke',
    }),
  });
  step('relational_group_create', grp.status === 201 && grp.data?.id, { status: grp.status });
  const groupId = grp.data?.id;

  let memberOk = false;
  if (groupId) {
    const mem = await vfetch(`/api/groups/${encodeURIComponent(groupId)}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ chartId: chartA }),
    });
    memberOk = mem.status === 201;
    step('relational_group_add_owner_chart', memberOk, { status: mem.status });

    const inv = await vfetch(`/api/groups/${encodeURIComponent(groupId)}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ inviteeUserId: userB, inviteeChartId: chartB }),
    });
    step('relational_group_invite', inv.status === 201 && inv.data?.id, { status: inv.status, inviteId: inv.data?.id });
    const inviteRowId = inv.data?.id;

    if (inviteRowId) {
      const gacc = await vfetch(
        `/api/groups/${encodeURIComponent(groupId)}/invites/${encodeURIComponent(inviteRowId)}/accept`,
        { method: 'POST', headers: { Cookie: cookieB } }
      );
      step('relational_group_invite_accept', gacc.status === 200, { status: gacc.status });
    } else {
      step('relational_group_invite_accept', false, { error: 'no_invite_id' });
    }
  }

  const invA2 = await vfetch('/api/community/inventory', { headers: { Cookie: cookieA } });
  const groupsA = invA2.data?.relationalGroups || [];
  step(
    'inventory_relational_group_listed',
    invA2.status === 200 && (!groupId || groupsA.some((g) => String(g.id) === String(groupId))),
    { status: invA2.status, groupCount: groupsA.length }
  );

  // --- Group composite then campaign (group mode) for inventory.campaigns ---
  if (groupId && memberOk) {
    const comp = await vfetch(`/api/groups/${encodeURIComponent(groupId)}/composite`, {
      headers: { Cookie: cookieA },
    });
    step('group_composite_for_campaign', comp.status === 200, { status: comp.status });

    const camp = await vfetch('/api/campaigns/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ mode: 'group', groupId }),
    });
    step('campaign_group_create', camp.status === 200 || camp.status === 201, {
      status: camp.status,
      campaignId: camp.data?.campaignId,
    });

    const invA3 = await vfetch('/api/community/inventory', { headers: { Cookie: cookieA } });
    const camps = invA3.data?.campaigns || [];
    const hasCamp = camp.data?.campaignId && camps.some((c) => String(c.campaignId) === String(camp.data.campaignId));
    step('inventory_campaign_present', invA3.status === 200 && hasCamp, {
      status: invA3.status,
      campaignCount: camps.length,
    });
  } else {
    step('group_composite_for_campaign', false, { skipped: true });
    step('campaign_group_create', false, { skipped: true });
    step('inventory_campaign_present', false, { skipped: true });
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  report.ok = false;
  report.fatal = String(e && e.stack ? e.stack : e);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
});
