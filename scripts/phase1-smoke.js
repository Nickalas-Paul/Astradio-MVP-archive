#!/usr/bin/env node
const { request } = require('undici');
/**
 * Phase 1 smoke: Stage 1 Single Profile System Walkthrough.
 * Profile create → GET profile → GET profile/chart (snapshot) → sky compose (Next route) → export → GET profile again → render 410.
 * Optional: sandbox compose (diagnostic, non-blocking).
 *
 * Usage:
 *   WEB_URL=https://your-app.vercel.app node scripts/phase1-smoke.js
 *   WEB_URL=http://localhost:3000 ENGINE_URL=http://localhost:4000 node scripts/phase1-smoke.js
 *
 * ENGINE_URL is optional; used only for final step (POST /api/render → 410).
 */
const WEB_URL = (process.env.WEB_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) || 'http://localhost:3000').replace(/\/+$/, '');
const ENGINE_URL = (process.env.ENGINE_URL || process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const ALLOW_SAME_HOST_FOR_DEV = process.env.ALLOW_WEB_ENGINE_SAME_HOST_FOR_DEV === '1';
const VERCEL_SHARE_TOKEN = process.env.VERCEL_SHARE_TOKEN || '';

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
  step1b: null,
  step2: null,
  step2sandbox: null,
  step3: null,
  step4: null,
  step5: null,
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

function sanitizeRequestHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    const key = String(k).toLowerCase();
    if (
      key === 'content-length' ||
      key === 'transfer-encoding' ||
      key === 'host' ||
      key === 'connection'
    ) {
      continue;
    }
    out[key] = v;
  }
  return out;
}

function withShare(url) {
  if (!VERCEL_SHARE_TOKEN) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('_vercel_share')) {
      u.searchParams.append('_vercel_share', VERCEL_SHARE_TOKEN);
    }
    return u.toString();
  } catch {
    // Fallback: naive query append
    if (url.includes('_vercel_share=')) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_vercel_share=${encodeURIComponent(VERCEL_SHARE_TOKEN)}`;
  }
}

function buildWebJsonHeaders(extra = {}) {
  const base = {
    'content-type': 'application/json',
  };
  const bypass = process.env.VERCEL_BYPASS_TOKEN;
  if (bypass && bypass.trim().length > 0) {
    base['x-vercel-protection-bypass'] = bypass;
  }
  const headers = { ...base, ...extra };
  return sanitizeRequestHeaders(headers);
}

function buildWebHeaders(extra = {}) {
  const base = {};
  const bypass = process.env.VERCEL_BYPASS_TOKEN;
  if (bypass && bypass.trim().length > 0) {
    base['x-vercel-protection-bypass'] = bypass;
  }
  const headers = { ...base, ...extra };
  return sanitizeRequestHeaders(headers);
}

async function step1() {
  console.log('\n--- Step 1: Profile persistence ---');
  const bypass = process.env.VERCEL_BYPASS_TOKEN;
  const share = process.env.VERCEL_SHARE_TOKEN;
  console.log('bypassTokenPresent:', !!(bypass && bypass.trim().length > 0));
  console.log('bypassTokenLength:', (bypass || '').length);
  console.log('shareTokenPresent:', !!(share && share.trim().length > 0));
  const createBody = {
    displayName: 'Phase1 Smoke ' + Date.now(),
    chart: { label: 'Smoke Chart', date: '1990-01-01', time: '12:00', lat: 40.7128, lon: -74.006 },
  };
  const createUrl = `${WEB_URL}/api/profile`;
  const createFullUrl = withShare(createUrl);
  const createHeaders = buildWebJsonHeaders();
  const createBodyStr = JSON.stringify(createBody);
  console.log('Step1 POST URL:', createFullUrl);
  console.log('Step1 headers keys:', Object.keys(createHeaders));
  if (Object.keys(createHeaders).some((k) => k.toLowerCase() === 'content-length')) {
    throw new Error('BUG: content-length header is being set in request headers');
  }
  const createRes = await request(createFullUrl, {
    method: 'POST',
    headers: createHeaders,
    body: createBodyStr,
    maxRedirections: 0,
  });
  const createText = await createRes.body.text();
  let createData = {};
  try {
    createData = createText ? JSON.parse(createText) : {};
  } catch {
    createData = {};
  }
  const createSnippet = createText ? createText.slice(0, 200) : '';
  const createStatus = createRes.statusCode;
  if (createStatus === 301 || createStatus === 302 || createStatus === 307 || createStatus === 308) {
    const loc = createRes.headers.location || '';
    const sc = createRes.headers['set-cookie'];
    const setCookieCount = Array.isArray(sc) ? sc.length : sc ? 1 : 0;
    results.step1 = {
      pass: false,
      error: `POST /api/profile redirect ${createStatus}`,
      status: createStatus,
      location: loc,
      setCookieCount,
      snippet: createSnippet,
    };
    console.log('  status:', createStatus);
    console.log('  location:', loc);
    console.log('  set-cookie count:', setCookieCount);
    console.log('  reason: bypass token not applied or not enabled for this deployment');
    return;
  }
  if (createStatus === 401 || createStatus === 403) {
    results.meta.webAuthGate = true;
    results.step1 = {
      pass: false,
      error: `POST /api/profile ${createStatus} (web auth gate)`,
      status: createStatus,
      body: createData,
      snippet: createSnippet,
    };
    return;
  }
  if (createStatus !== 201 || !createData?.user?.id) {
    results.step1 = {
      pass: false,
      error: `POST /api/profile ${createStatus} or no user.id`,
      status: createStatus,
      body: createData,
      snippet: createSnippet,
    };
    return;
  }
  const userId = createData.user.id;
  const primaryChartId = createData.primaryChart?.id || null;
  const setCookieRaw = createRes.headers['set-cookie'];
  const setCookie = Array.isArray(setCookieRaw) ? setCookieRaw[0] : (setCookieRaw || '');
  const cookie = cookieFromSetCookie(setCookie);
  const hasLegacy = cookie && cookie.includes('astradio_dev_user_id');
  const hasSession = cookie && cookie.includes('astradio_session');
  const sessionCookie = hasSession || hasLegacy ? cookie : null;
  if (!sessionCookie) {
    results.step1 = {
      pass: false,
      error: 'astradio_session or astradio_dev_user_id cookie not set',
      cookie: setCookie || '(none)',
    };
    return;
  }
  const cookieForLater = sessionCookie;

  const getBaseUrl = `${WEB_URL}/api/profile`;
  const getFullUrl = withShare(getBaseUrl);
  const getHeaders = buildWebHeaders({ cookie: cookieForLater });
  const getRes = await request(getFullUrl, {
    method: 'GET',
    headers: getHeaders,
    maxRedirections: 0,
  });
  const getText = await getRes.body.text();
  let getData = {};
  try {
    getData = getText ? JSON.parse(getText) : {};
  } catch {
    getData = {};
  }
  const getSnippet = getText ? getText.slice(0, 200) : '';
  const getStatus = getRes.statusCode;
  if (getStatus === 301 || getStatus === 302 || getStatus === 307 || getStatus === 308) {
    const loc = getRes.headers.location || '';
    const sc = getRes.headers['set-cookie'];
    const setCookieCount = Array.isArray(sc) ? sc.length : sc ? 1 : 0;
    results.step1 = {
      pass: false,
      error: `GET /api/profile redirect ${getStatus}`,
      status: getStatus,
      location: loc,
      setCookieCount,
      snippet: getSnippet,
    };
    console.log('  status:', getStatus);
    console.log('  location:', loc);
    console.log('  set-cookie count:', setCookieCount);
    console.log('  reason: bypass token not applied or not enabled for this deployment');
    return;
  }
  if (getStatus === 401 || getStatus === 403) {
    results.meta.webAuthGate = true;
    results.step1 = {
      pass: false,
      error: `GET /api/profile ${getStatus} (web auth gate)`,
      status: getStatus,
      body: getData,
      snippet: getSnippet,
    };
    return;
  }
  if (getStatus < 200 || getStatus >= 300 || getData?.user?.id !== userId) {
    results.step1 = {
      pass: false,
      error: `GET /api/profile ${getStatus} or user id mismatch`,
      status: getStatus,
      body: getData,
      snippet: getSnippet,
    };
    return;
  }

  // Statelessness / persistence simulation: wait briefly and fetch again with same cookie.
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const getFullUrl2 = withShare(getBaseUrl);
  const getHeaders2 = buildWebHeaders({ cookie: cookieForLater });
  const getRes2 = await request(getFullUrl2, {
    method: 'GET',
    headers: getHeaders2,
    maxRedirections: 0,
  });
  const getText2 = await getRes2.body.text();
  let getData2 = {};
  try {
    getData2 = getText2 ? JSON.parse(getText2) : {};
  } catch {
    getData2 = {};
  }
  const getSnippet2 = getText2 ? getText2.slice(0, 200) : '';
  const getStatus2 = getRes2.statusCode;
  if (getStatus2 === 301 || getStatus2 === 302 || getStatus2 === 307 || getStatus2 === 308) {
    const loc = getRes2.headers.location || '';
    const sc = getRes2.headers['set-cookie'];
    const setCookieCount = Array.isArray(sc) ? sc.length : sc ? 1 : 0;
    results.step1 = {
      pass: false,
      error: `GET /api/profile (second read) redirect ${getStatus2}`,
      status: getStatus2,
      location: loc,
      setCookieCount,
      snippet: getSnippet2,
    };
    console.log('  status:', getStatus2);
    console.log('  location:', loc);
    console.log('  set-cookie count:', setCookieCount);
    console.log('  reason: bypass token not applied or not enabled for this deployment');
    return;
  }
  if (getStatus2 === 401 || getStatus2 === 403) {
    results.meta.webAuthGate = true;
    results.step1 = {
      pass: false,
      error: `GET /api/profile (second read) ${getStatus2} (web auth gate)`,
      status: getStatus2,
      body: getData2,
      snippet: getSnippet2,
    };
    return;
  }
  if (getStatus2 < 200 || getStatus2 >= 300 || getData2?.user?.id !== userId) {
    results.step1 = {
      pass: false,
      error: `GET /api/profile (second read) ${getStatus2} or user id mismatch`,
      status: getStatus2,
      body: getData2,
      snippet: getSnippet2,
    };
    return;
  }

  results.step1 = {
    pass: true,
    userId,
    primaryChartId,
    cookie: cookieForLater,
    cookieSet: true,
    getProfileSameUser: true,
    secondReadSameUser: true,
  };
  console.log('  userId:', userId);
  console.log('  primaryChartId:', primaryChartId);
  console.log('  cookie: set');
  console.log('  GET /api/profile: same user returned (first read)');
  console.log('  GET /api/profile: same user returned (second read after delay)');
}

async function step1b() {
  console.log('\n--- Step 1b: GET /api/profile/chart (chart snapshot persistence) ---');
  const cookie = results.step1?.cookie;
  const primaryChartId = results.step1?.primaryChartId;
  if (!results.step1?.pass || !cookie) {
    results.step1b = { pass: false, error: 'Step 1 did not pass or no cookie; skip profile/chart' };
    console.log('  (skipped: step1 not pass or no cookie)');
    return;
  }
  if (!primaryChartId) {
    results.step1b = { pass: false, error: 'No primaryChart.id from Step 1; cannot verify chart snapshot' };
    console.log('  (fail: no primaryChartId)');
    return;
  }
  const chartUrl = withShare(`${WEB_URL}/api/profile/chart?chartId=${encodeURIComponent(primaryChartId)}`);
  const chartHeaders = buildWebHeaders({ cookie });
  let chartRes;
  try {
    chartRes = await request(chartUrl, { method: 'GET', headers: chartHeaders, maxRedirections: 0 });
  } catch (e) {
    results.step1b = { pass: false, error: 'GET /api/profile/chart request failed: ' + (e && e.message) };
    console.log('  error:', e && e.message);
    return;
  }
  const chartText = await chartRes.body.text();
  let chartData = {};
  try {
    chartData = chartText ? JSON.parse(chartText) : {};
  } catch {
    chartData = {};
  }
  const status = chartRes.statusCode;
  if (status !== 200) {
    results.step1b = { pass: false, error: `GET /api/profile/chart ${status}`, status, body: chartData };
    console.log('  status:', status);
    return;
  }
  const snapshot = chartData.snapshot;
  const planets = snapshot && Array.isArray(snapshot.planets) ? snapshot.planets : [];
  const houses = snapshot && Array.isArray(snapshot.houses) ? snapshot.houses : [];
  const sections = chartData.explainer && Array.isArray(chartData.explainer.sections) ? chartData.explainer.sections : [];
  const okSnapshot = snapshot && typeof snapshot === 'object';
  const okPlanets = planets.length > 0;
  const okHouses = houses.length >= 12;
  const okSections = sections.length > 0;
  const pass = okSnapshot && okPlanets && okHouses && okSections;
  results.step1b = {
    pass,
    status: 200,
    snapshotPresent: okSnapshot,
    planetsLength: planets.length,
    housesLength: houses.length,
    sectionsLength: sections.length,
  };
  if (!pass) {
    results.step1b.error = !okSnapshot ? 'missing snapshot' : !okPlanets ? 'snapshot.planets.length === 0' : !okHouses ? 'snapshot.houses.length < 12' : !okSections ? 'explainer.sections.length === 0' : 'unknown';
  }
  console.log('  status: 200');
  console.log('  snapshot.planets.length:', planets.length);
  console.log('  snapshot.houses.length:', houses.length);
  console.log('  explainer.sections.length:', sections.length);
  console.log('  pass:', pass);
}

async function step2() {
  console.log('\n--- Step 2: Sky compose (Next route, Home client shape) — history anchor ---');
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;
  const composeBody = {
    date: dateStr,
    time: timeStr,
    location: {
      source: 'browser_geo',
      label: '40.71, -74.01',
      lat: 40.7128,
      lon: -74.006,
      timezone: 'America/New_York',
      resolvedAt: new Date().toISOString(),
    },
  };
  const composeUrl = `${WEB_URL}/api/compose`;
  const composeFullUrl = withShare(composeUrl);
  const composeHeaders = buildWebJsonHeaders();
  const composeBodyStr = JSON.stringify(composeBody);
  let res;
  try {
    res = await request(composeFullUrl, {
      method: 'POST',
      headers: composeHeaders,
      body: composeBodyStr,
      maxRedirections: 0,
    });
  } catch (e) {
    results.step2 = { pass: false, error: 'POST /api/compose (sky) request failed: ' + (e && e.message) };
    console.log('  error:', e && e.message);
    return;
  }
  const text = await res.body.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  const snippet = text ? text.slice(0, 200) : '';
  const status = res.statusCode;
  if (status === 301 || status === 302 || status === 307 || status === 308) {
    results.step2 = { pass: false, error: `POST /api/compose redirect ${status}`, status, snippet };
    return;
  }
  if (status === 401 || status === 403) {
    results.meta.webAuthGate = true;
    results.step2 = { pass: false, error: `POST /api/compose ${status} (web auth gate)`, status, body: data, snippet };
    return;
  }
  if (status < 200 || status >= 300) {
    results.step2 = { pass: false, error: `POST /api/compose ${status}`, status, body: data, snippet };
    return;
  }
  const sections = data.explanation?.sections;
  const hasSections = Array.isArray(sections) && sections.length > 0;
  const exportId = data.export_id;
  const audio = data.audio || {};
  const hasExportId = typeof exportId === 'string' && exportId.length > 0;
  const hasBase64 = typeof audio.base64 === 'string' && audio.base64.length > 0;
  const hasUrl = typeof audio.url === 'string' && audio.url.length > 0;
  const audioOk = hasExportId || hasBase64 || hasUrl;
  const pass = hasSections && audioOk;
  results.step2 = {
    pass,
    explanation_sections: hasSections ? sections.length : 0,
    export_id: exportId || null,
    audioOk,
    excerpt: {
      export_id: exportId ? exportId.slice(0, 16) + '...' : null,
      section_titles: sections ? sections.map((s) => s.title) : [],
    },
  };
  if (!pass) results.step2.error = !hasSections ? 'missing explanation.sections' : !audioOk ? 'audio: no export_id, base64, or url' : 'unknown';
  console.log('  status:', status);
  console.log('  explanation.sections.length:', hasSections ? sections.length : 0);
  console.log('  export_id:', exportId ? exportId.slice(0, 20) + '...' : 'null');
  console.log('  audio (export_id/base64/url):', audioOk);
  console.log('  pass:', pass);
}

async function step2sandbox() {
  console.log('\n--- Step 2sandbox: Sandbox compose (diagnostic, non-blocking) ---');
  const composeBody = {
    mode: 'sandbox',
    chartData: { date: '1990-01-01', time: '12:00', lat: 40.7128, lon: -74.006 },
    controls: {},
  };
  const composeUrl = `${WEB_URL}/api/compose`;
  const composeFullUrl = withShare(composeUrl);
  const composeHeaders = buildWebJsonHeaders();
  let res;
  try {
    res = await request(composeFullUrl, {
      method: 'POST',
      headers: composeHeaders,
      body: JSON.stringify(composeBody),
      maxRedirections: 0,
    });
  } catch (e) {
    results.step2sandbox = { pass: false, diagnostic: true, error: e && e.message };
    console.log('  diagnostic only; error:', e && e.message);
    return;
  }
  const text = await res.body.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  const ok = res.statusCode === 200 && Array.isArray(data.explanation?.sections) && data.explanation.sections.length > 0;
  results.step2sandbox = { pass: ok, diagnostic: true, status: res.statusCode };
  console.log('  diagnostic only; status:', res.statusCode, 'sections:', data.explanation?.sections?.length ?? 0);
}

async function step3() {
  console.log('\n--- Step 3: Export through Web proxy (export_id from Step 2 sky compose) ---');
  const exportId = results.step2?.export_id;
  if (!exportId) {
    results.step3 = { pass: true, skipped: true, reason: 'No export_id from Step 2; Audio Standard satisfied by base64/url' };
    console.log('  (skipped: no export_id from sky compose)');
    return;
  }
  const exportUrl = withShare(`${WEB_URL}/api/exports/${exportId}`);
  const res = await fetch(exportUrl, {
    headers: buildWebHeaders(),
  });
  const contentType = res.headers.get('content-type') || '';
  const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
  const byteLength = buf.byteLength;

  const status200 = res.status === 200;
  const nonZero = byteLength > 0;
  const pass = status200 && nonZero;

  results.step3 = {
    pass,
    status: res.status,
    contentType,
    byteLength,
    status200,
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
  console.log('  pass:', pass);
}

async function step4() {
  console.log('\n--- Step 4: GET /api/profile again (identity persistence) ---');
  const cookie = results.step1?.cookie;
  const userId = results.step1?.userId;
  const primaryChartId = results.step1?.primaryChartId;
  if (!results.step1?.pass || !cookie) {
    results.step4 = { pass: false, error: 'Step 1 not pass or no cookie' };
    console.log('  (skip: no cookie)');
    return;
  }
  const getUrl = withShare(`${WEB_URL}/api/profile`);
  const headers = buildWebHeaders({ cookie });
  let res;
  try {
    res = await request(getUrl, { method: 'GET', headers, maxRedirections: 0 });
  } catch (e) {
    results.step4 = { pass: false, error: 'GET /api/profile failed: ' + (e && e.message) };
    console.log('  error:', e && e.message);
    return;
  }
  const text = await res.body.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  const statusOk = res.statusCode === 200;
  const sameUser = data.user && data.user.id === userId;
  const sameChart = (data.primaryChart && data.primaryChart.id) === primaryChartId;
  const pass = statusOk && sameUser && sameChart;
  results.step4 = { pass, status: res.statusCode, sameUser, sameChart };
  if (!pass) results.step4.error = !statusOk ? `status ${res.statusCode}` : !sameUser ? 'user.id mismatch' : !sameChart ? 'primaryChart.id mismatch' : 'unknown';
  console.log('  status:', res.statusCode);
  console.log('  user.id unchanged:', sameUser);
  console.log('  primaryChart.id unchanged:', sameChart);
  console.log('  pass:', pass);
}

async function step5() {
  console.log('\n--- Step 5: Regression guard (POST /api/render 410) ---');
  const res = await fetch(`${ENGINE_URL}/api/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const is410 = res.status === 410;
  results.step5 = {
    pass: is410,
    status: res.status,
    endpoint: `${ENGINE_URL}/api/render`,
  };
  if (!is410) results.step5.error = `expected 410, got ${res.status}`;
  console.log('  POST /api/render →', res.status, is410 ? '(410 Gone OK)' : '(expected 410)');
}

function report() {
  const s1 = results.step1?.pass;
  const s1b = results.step1b?.pass;
  const s2 = results.step2?.pass;
  const s3 = results.step3?.pass;
  const s4 = results.step4?.pass;
  const s5 = results.step5?.pass;
  const sameHost = results.meta?.sameHost;
  const webAuthGate = results.meta?.webAuthGate;
  const exportRequired = results.step2?.export_id;
  const allCore = s1 && s1b && s2 && (exportRequired ? s3 : true) && s4 && s5;
  const all = allCore && (!sameHost || ALLOW_SAME_HOST_FOR_DEV);

  console.log('\n========== STAGE 1 REPORT ==========');
  console.log('Step 1 (profile):', s1 ? 'PASS' : 'FAIL');
  console.log('Step 1b (profile/chart):', s1b ? 'PASS' : 'FAIL');
  console.log('Step 2 (sky compose):', s2 ? 'PASS' : 'FAIL');
  console.log('Step 2sandbox (diagnostic):', results.step2sandbox?.pass ? 'PASS' : 'FAIL', '(non-blocking)');
  console.log('Step 3 (export):', results.step3?.skipped ? 'SKIP' : (s3 ? 'PASS' : 'FAIL'));
  console.log('Step 4 (profile again):', s4 ? 'PASS' : 'FAIL');
  console.log('Step 5 (render 410):', s5 ? 'PASS' : 'FAIL');
  if (all) {
    console.log('');
    console.log('STAGE 1 STATUS: PASS');
    console.log('');
    console.log('Evidence:');
    console.log('- engine_url:', ENGINE_URL);
    console.log('- web_url:', WEB_URL);
    console.log('- user_id:', results.step1?.userId);
    console.log('- primary_chart_id:', results.step1?.primaryChartId);
    console.log('- sky compose excerpt:', JSON.stringify(results.step2?.excerpt, null, 2));
    console.log('- export:', results.step3?.skipped ? 'skipped (no export_id)' : 'status ' + results.step3?.status + ' bytes ' + results.step3?.byteLength);
  } else if (webAuthGate) {
    console.log('');
    console.log('STAGE 1 STATUS: BLOCKED');
    console.log('reason: web auth gate (vercel protection)');
  } else if (sameHost && !ALLOW_SAME_HOST_FOR_DEV) {
    console.log('');
    console.log('STAGE 1 STATUS: BLOCKED');
    console.log('reason: WEB_URL and ENGINE_URL hosts match (dev-only configuration)');
  } else {
    const failing = [];
    if (!s1) failing.push('Step 1 (profile)');
    if (!s1b) failing.push('Step 1b (profile/chart)');
    if (!s2) failing.push('Step 2 (sky compose)');
    if (exportRequired && !s3) failing.push('Step 3 (export)');
    if (!s4) failing.push('Step 4 (profile again)');
    if (!s5) failing.push('Step 5 (render 410)');
    console.log('');
    console.log('STAGE 1 STATUS: BLOCKED');
    console.log('Failing step:', failing.join(', '));
    if (results.step1 && !results.step1.pass) console.log('Step 1:', results.step1.error);
    if (results.step1b && !results.step1b.pass) console.log('Step 1b:', results.step1b.error);
    if (results.step2 && !results.step2.pass) console.log('Step 2:', results.step2.error);
    if (results.step3 && !results.step3.pass && !results.step3.skipped) console.log('Step 3:', results.step3.error);
    if (results.step4 && !results.step4.pass) console.log('Step 4:', results.step4.error);
    if (results.step5 && !results.step5.pass) console.log('Step 5:', results.step5.error);
  }
  console.log('=====================================\n');
  process.exit(all ? 0 : 1);
}

async function main() {
  console.log('Stage 1 smoke — WEB_URL:', WEB_URL, 'ENGINE_URL:', ENGINE_URL);
  try {
    await step1();
    await step1b();
    await step2();
    await step2sandbox();
    await step3();
    await step4();
    await step5();
  } catch (e) {
    console.error(e);
    results.blocked = { error: e.message };
    console.log('\nSTAGE 1 STATUS: BLOCKED');
    console.log('Failing step: exception');
    console.log('Error:', e.message);
    process.exit(1);
  }
  report();
}

main();
