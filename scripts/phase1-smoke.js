#!/usr/bin/env node
/**
 * Phase 1 smoke: vertical slice through the web surface.
 * User/Profile → Chart → Compose → Explainer → Export → Download
 *
 * Usage:
 *   WEB_URL=https://your-app.vercel.app node scripts/phase1-smoke.js
 *   WEB_URL=http://localhost:3000 ENGINE_URL=http://localhost:4000 node scripts/phase1-smoke.js
 *
 * ENGINE_URL is optional; used only for Step 4 (POST /api/render → 410).
 * All other steps use WEB_URL (Next proxy).
 */
const WEB_URL = (process.env.WEB_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) || 'http://localhost:3000').replace(/\/+$/, '');
const ENGINE_URL = (process.env.ENGINE_URL || process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const ALLOW_SAME_HOST_FOR_DEV = process.env.ALLOW_WEB_ENGINE_SAME_HOST_FOR_DEV === '1';
const VERCEL_BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN || '';

let webHost = 'unknown';
let engineHost = 'unknown';
try {
  webHost = new URL(WEB_URL).host;
} catch {}
try {
  engineHost = new URL(ENGINE_URL).host;
} catch {}

const results = {
  step1: null,
  step2: null,
  step3: null,
  step4: null,
  blocked: null,
  meta: {
    webHost,
    engineHost,
    sameHost: webHost && engineHost && webHost === engineHost,
    webAuthGate: false,
  },
};

function cookieFromSetCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  const first = setCookieHeader.split(',')[0];
  const part = first.split(';')[0].trim();
  return part;
}

function withBypass(headers = {}) {
  const h = { ...headers };
  if (VERCEL_BYPASS_TOKEN) {
    h['x-vercel-protection-bypass'] = VERCEL_BYPASS_TOKEN;
  }
  return h;
}

async function step1() {
  console.log('\n--- Step 1: Profile persistence ---');
  const createBody = {
    displayName: 'Phase1 Smoke ' + Date.now(),
    chart: { label: 'Smoke Chart', date: '1990-01-01', time: '12:00', lat: 40.7128, lon: -74.006 },
  };
  const createRes = await fetch(`${WEB_URL}/api/profile`, {
    method: 'POST',
    headers: withBypass({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(createBody),
  });
  const createData = await createRes.json().catch(() => ({}));
  if (createRes.status === 401 || createRes.status === 403) {
    results.meta.webAuthGate = true;
    results.step1 = {
      pass: false,
      error: `POST /api/profile ${createRes.status} (web auth gate)`,
      status: createRes.status,
      body: createData,
    };
    return;
  }
  if (createRes.status !== 201 || !createData?.user?.id) {
    results.step1 = { pass: false, error: `POST /api/profile ${createRes.status} or no user.id`, body: createData };
    return;
  }
  const userId = createData.user.id;
  const primaryChartId = createData.primaryChart?.id || null;
  const setCookie = createRes.headers.get('set-cookie');
  const cookie = cookieFromSetCookie(setCookie);
  if (!cookie || !cookie.includes('astradio_dev_user_id')) {
    results.step1 = { pass: false, error: 'astradio_dev_user_id cookie not set', cookie: setCookie || '(none)' };
    return;
  }

  const getRes = await fetch(`${WEB_URL}/api/profile`, {
    headers: withBypass({ Cookie: cookie }),
  });
  const getData = await getRes.json().catch(() => ({}));
  if (getRes.status === 401 || getRes.status === 403) {
    results.meta.webAuthGate = true;
    results.step1 = {
      pass: false,
      error: `GET /api/profile ${getRes.status} (web auth gate)`,
      status: getRes.status,
      body: getData,
    };
    return;
  }
  if (!getRes.ok || getData?.user?.id !== userId) {
    results.step1 = { pass: false, error: `GET /api/profile ${getRes.status} or user id mismatch`, body: getData };
    return;
  }

  // Statelessness / persistence simulation: wait briefly and fetch again with same cookie.
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const getRes2 = await fetch(`${WEB_URL}/api/profile`, {
    headers: withBypass({ Cookie: cookie }),
  });
  const getData2 = await getRes2.json().catch(() => ({}));
  if (getRes2.status === 401 || getRes2.status === 403) {
    results.meta.webAuthGate = true;
    results.step1 = {
      pass: false,
      error: `GET /api/profile (second read) ${getRes2.status} (web auth gate)`,
      status: getRes2.status,
      body: getData2,
    };
    return;
  }
  if (!getRes2.ok || getData2?.user?.id !== userId) {
    results.step1 = {
      pass: false,
      error: `GET /api/profile (second read) ${getRes2.status} or user id mismatch`,
      body: getData2,
    };
    return;
  }

  results.step1 = {
    pass: true,
    userId,
    primaryChartId,
    cookieSet: true,
    getProfileSameUser: true,
    secondReadSameUser: true,
  };
  console.log('  userId:', userId);
  console.log('  primaryChartId:', primaryChartId);
  console.log('  cookie astradio_dev_user_id: set');
  console.log('  GET /api/profile: same user returned (first read)');
  console.log('  GET /api/profile: same user returned (second read after delay)');
}

async function step2() {
  console.log('\n--- Step 2: Compose via Web ---');
  const composeBody = {
    mode: 'sandbox',
    chartData: { date: '1990-01-01', time: '12:00', lat: 40.7128, lon: -74.006 },
    controls: {},
  };
  const res = await fetch(`${WEB_URL}/api/compose`, {
    method: 'POST',
    headers: withBypass({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(composeBody),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    results.meta.webAuthGate = true;
    results.step2 = {
      pass: false,
      error: `POST /api/compose ${res.status} (web auth gate)`,
      status: res.status,
      body: data,
    };
    return;
  }
  if (!res.ok) {
    results.step2 = { pass: false, error: `POST /api/compose ${res.status}`, body: data };
    return;
  }
  const planSha = data.hashes?.plan_sha256;
  const sections = data.explanation?.sections;
  const exportId = data.export_id;
  const audioDebug = data.audio_debug;
  const hasExportFailure = audioDebug && (audioDebug.export_failure || audioDebug.export_failure === 0);

  const hasPlanSha = !!planSha;
  const hasSections = Array.isArray(sections) && sections.length > 0;
  const hasExportId = !!exportId;
  const noAudioDebugErrors = !hasExportFailure;

  const pass = hasPlanSha && hasSections && noAudioDebugErrors;
  results.step2 = {
    pass,
    hashes_plan_sha256: hasPlanSha,
    explanation_sections: hasSections ? sections.length : 0,
    section_titles: sections ? sections.map((s) => s.title).filter(Boolean) : [],
    export_id: exportId || null,
    no_audio_debug_errors: noAudioDebugErrors,
    excerpt: {
      plan_sha256: planSha ? planSha.slice(0, 16) + '...' : null,
      export_id: exportId ? exportId.slice(0, 16) + '...' : null,
      section_titles: sections ? sections.map((s) => s.title) : [],
    },
  };
  if (!pass) results.step2.error = !hasPlanSha ? 'missing plan_sha256' : !hasSections ? 'missing explanation.sections' : !noAudioDebugErrors ? 'audio_debug export_failure' : 'unknown';

  console.log('  hashes.plan_sha256:', hasPlanSha ? planSha.slice(0, 20) + '...' : 'missing');
  console.log('  explanation.sections:', hasSections ? sections.length : 0, results.step2.section_titles?.length ? results.step2.section_titles : '');
  console.log('  export_id:', exportId ? exportId.slice(0, 20) + '...' : 'null');
  console.log('  no audio_debug errors:', noAudioDebugErrors);
  if (pass) {
    console.log('  [excerpt] plan_sha256:', results.step2.excerpt.plan_sha256, 'export_id:', results.step2.excerpt.export_id);
  }
}

async function step3() {
  console.log('\n--- Step 3: Export through Web proxy ---');
  const exportId = results.step2?.export_id;
  if (!exportId) {
    results.step3 = { pass: false, error: 'No export_id from Step 2; skip GET /api/exports/:id' };
    console.log('  (skipped: no export_id)');
    return;
  }
  const res = await fetch(`${WEB_URL}/api/exports/${exportId}`, {
    headers: withBypass(),
  });
  const contentType = res.headers.get('content-type') || '';
  const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
  const byteLength = buf.byteLength;

  const status200 = res.status === 200;
  const isWav = contentType.toLowerCase().includes('audio/wav');
  const nonZero = byteLength > 0;
  const pass = status200 && nonZero;

  results.step3 = {
    pass,
    status: res.status,
    contentType,
    byteLength,
    status200,
    content_type_audio_wav: isWav,
    non_zero_bytes: nonZero,
  };
  if (!pass) {
    if (res.status === 401 || res.status === 403) {
      results.meta.webAuthGate = true;
      results.step3.error = `GET /api/exports/:id ${res.status} (web auth gate)`;
    } else {
      results.step3.error = !status200 ? `status ${res.status}` : !nonZero ? 'zero bytes' : '';
    }
  }

  console.log('  GET /api/exports/:id →', res.status, contentType, byteLength, 'bytes');
  console.log('  status 200:', status200, 'content-type audio/wav:', isWav, 'non-zero:', nonZero);
}

async function step4() {
  console.log('\n--- Step 4: Regression guards ---');
  const res = await fetch(`${ENGINE_URL}/api/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const is410 = res.status === 410;
  results.step4 = {
    pass: is410,
    status: res.status,
    endpoint: `${ENGINE_URL}/api/render`,
  };
  if (!is410) results.step4.error = `expected 410, got ${res.status}`;
  console.log('  POST /api/render →', res.status, is410 ? '(410 Gone OK)' : '(expected 410)');
  console.log('  Single planner / no duplicate provider: confirm from existing engine logs ([COMPOSE_PATH] planner=generatePlanMLOnly, one line per compose).');
}

function report() {
  const s1 = results.step1?.pass;
  const s2 = results.step2?.pass;
  const s3 = results.step3?.pass;
  const s4 = results.step4?.pass;
  const sameHost = results.meta?.sameHost;
  const webAuthGate = results.meta?.webAuthGate;
  const allCore = s1 && s2 && s4 && (results.step2?.export_id ? s3 : true);
  const all = allCore && (!sameHost || ALLOW_SAME_HOST_FOR_DEV);

  console.log('\n========== PHASE 1 REPORT ==========');
  if (all) {
    console.log('PHASE 1 STATUS: PASS');
    console.log('');
    console.log('Evidence:');
    console.log('- commit: (fill after deploy)');
    console.log('- engine_url:', ENGINE_URL);
    console.log('- web_url:', WEB_URL);
    console.log('- user_id:', results.step1?.userId);
    console.log('- primary_chart_id:', results.step1?.primaryChartId);
    console.log('- compose excerpt:', JSON.stringify(results.step2?.excerpt, null, 2));
    console.log('- WAV proof: status', results.step3?.status ?? 'n/a', 'bytes', results.step3?.byteLength ?? 'n/a');
  } else if (webAuthGate) {
    console.log('PHASE 1 STATUS: BLOCKED');
    console.log('');
    console.log('reason: web auth gate (vercel protection)');
    console.log('minimal next action: deploy an unprotected web environment for smoke');
  } else if (sameHost && !ALLOW_SAME_HOST_FOR_DEV) {
    console.log('PHASE 1 STATUS: BLOCKED');
    console.log('');
    console.log('reason: WEB_URL and ENGINE_URL hosts match (dev-only configuration)');
    console.log('minimal next action: run against a real web surface (Next) whose host differs from the engine');
  } else {
    const failing = [];
    if (!s1) failing.push('Step 1 (profile persistence)');
    if (!s2) failing.push('Step 2 (compose via web)');
    if (!s3 && results.step2?.export_id) failing.push('Step 3 (export proxy)');
    if (!s4) failing.push('Step 4 (POST /api/render 410)');
    console.log('PHASE 1 STATUS: BLOCKED');
    console.log('');
    console.log('Failing step:', failing.join(', '));
    if (results.step1 && !results.step1.pass) console.log('Step 1:', results.step1.error, results.step1.body ?? '');
    if (results.step2 && !results.step2.pass) console.log('Step 2:', results.step2.error, results.step2.excerpt ?? '');
    if (results.step3 && !results.step3.pass) console.log('Step 3:', results.step3.error ?? results.step3);
    if (results.step4 && !results.step4.pass) console.log('Step 4:', results.step4.error, 'endpoint:', results.step4.endpoint);
    console.log('');
    console.log('Minimal next action: fix the failing step above (no new scope).');
  }
  console.log('=====================================\n');
  process.exit(all ? 0 : 1);
}

async function main() {
  console.log('Phase 1 smoke — WEB_URL:', WEB_URL, 'ENGINE_URL:', ENGINE_URL);
  try {
    await step1();
    await step2();
    await step3();
    await step4();
  } catch (e) {
    console.error(e);
    results.blocked = { error: e.message };
    console.log('\nPHASE 1 STATUS: BLOCKED');
    console.log('Failing step: exception');
    console.log('Error:', e.message);
    process.exit(1);
  }
  report();
}

main();
