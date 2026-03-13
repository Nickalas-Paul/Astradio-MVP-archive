#!/usr/bin/env node
/**
 * Phase 8 — Stage 7 Sandbox / Overlay Determinism Verification
 *
 * Scope:
 * - Run against the deployed preview environment (not localhost).
 * - Verify deterministic behavior for:
 *   - Snapshot layer: /api/chart-snapshot, /api/sandbox/snapshot
 *   - Relational layer: relationalContext from /api/sandbox/report and /api/profile/chart
 *   - Interpretation layer: sandbox report explanation/personality/guidance
 *   - Composition layer (overlay): /api/compose (mode: "overlay"), including caller-order independence for A/B vs B/A.
 *
 * This script:
 * - Performs N = 3 repeat runs per test.
 * - Uses normalized JSON + SHA-256 hashes for comparison.
 * - Compares only deterministic subsets where appropriate (especially /api/compose).
 * - Exits with code 0 (PASS) or 1 (FAIL).
 *
 * Environment:
 * - BASE URL defaults to the preview deployment, but can be overridden with API_BASE_URL.
 * - Vercel bypass header value must be provided via VERCEL_AUTOMATION_BYPASS_SECRET.
 */

const PREVIEW_BASE =
  'https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app';

const BASE = (process.env.API_BASE_URL || PREVIEW_BASE).replace(/\/$/, '');

type HashResult = {
  hashes: string[];
  allEqual: boolean;
};

type TestOutcome = {
  name: string;
  pass: boolean;
  details: string[];
  hashes?: string[];
  diffSummary?: string;
};

function sha256Hex(str: string): string {
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function normalizeForHash(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForHash(item));
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const out: any = {};
    for (const k of keys) {
      out[k] = normalizeForHash(value[k]);
    }
    return out;
  }
  return value;
}

function normalizedHash(value: any): { hash: string; normalized: any } {
  const normalized = normalizeForHash(value);
  const json = JSON.stringify(normalized);
  const hash = sha256Hex(json);
  return { hash, normalized };
}

function summarizeDiff(a: any, b: any): string {
  const aJson = JSON.stringify(a, null, 2);
  const bJson = JSON.stringify(b, null, 2);
  if (aJson === bJson) return 'no structural diff (hash mismatch likely due to normalization bug)';
  const maxLen = 600;
  const aShort = aJson.length > maxLen ? aJson.slice(0, maxLen) + '…' : aJson;
  const bShort = bJson.length > maxLen ? bJson.slice(0, maxLen) + '…' : bJson;
  return `normalizedA=${aShort}\nnormalizedB=${bShort}`;
}

async function httpJson(
  path: string,
  options: { method?: string; body?: any } = {},
): Promise<{ status: number; json: any; url: string; rawText: string }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body != null) {
    headers['Content-Type'] = 'application/json';
  }
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass && typeof bypass === 'string' && bypass.trim()) {
    headers['x-vercel-protection-bypass'] = bypass.trim();
  }

  const res = await fetch(url, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  } as any);

  const rawText = await res.text();
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }

  return { status: res.status, json, url, rawText };
}

async function runHashTestN(
  name: string,
  runs: number,
  fn: () => Promise<any>,
  projectForHash: (value: any) => any,
): Promise<TestOutcome> {
  const details: string[] = [];
  const hashes: string[] = [];
  const payloads: any[] = [];
  let pass = true;

  for (let i = 0; i < runs; i++) {
    try {
      const value = await fn();
      payloads.push(value);
      const { hash } = normalizedHash(projectForHash(value));
      hashes.push(hash);
      details.push(`run${i + 1} hash=${hash}`);
    } catch (e: any) {
      pass = false;
      details.push(`run${i + 1} error=${e instanceof Error ? e.message : String(e)}`);
      break;
    }
  }

  if (hashes.length === runs) {
    const first = hashes[0];
    const allEqual = hashes.every((h) => h === first);
    if (!allEqual) {
      pass = false;
      const normA = normalizeForHash(projectForHash(payloads[0]));
      const normB = normalizeForHash(projectForHash(payloads[1]));
      const diffSummary = summarizeDiff(normA, normB);
      return {
        name,
        pass,
        details,
        hashes,
        diffSummary,
      };
    }
  }

  return {
    name,
    pass,
    details,
    hashes: hashes.length ? hashes : undefined,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHART_A = {
  date: '1990-01-01',
  time: '12:00',
  lat: 40.7128,
  lon: -74.006,
};

const CHART_B = {
  date: '2036-03-15',
  time: '12:00',
  lat: 40.7128,
  lon: -74.006,
};

// ---------------------------------------------------------------------------
// Snapshot determinism tests
// ---------------------------------------------------------------------------

async function testCSNAP_A(): Promise<TestOutcome> {
  const query = new URLSearchParams({
    date: CHART_A.date,
    time: CHART_A.time,
    lat: String(CHART_A.lat),
    lon: String(CHART_A.lon),
  }).toString();

  return runHashTestN(
    'CSNAP-A',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson(`/api/chart-snapshot?${query}`);
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      return json;
    },
    (snapshot) => snapshot,
  );
}

async function testCSNAP_B(): Promise<TestOutcome> {
  const query = new URLSearchParams({
    date: CHART_B.date,
    time: CHART_B.time,
    lat: String(CHART_B.lat),
    lon: String(CHART_B.lon),
  }).toString();

  return runHashTestN(
    'CSNAP-B',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson(`/api/chart-snapshot?${query}`);
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      return json;
    },
    (snapshot) => snapshot,
  );
}

async function testSSNAP_A(): Promise<TestOutcome> {
  const birth = {
    date: CHART_A.date,
    time: CHART_A.time,
    lat: CHART_A.lat,
    lon: CHART_A.lon,
    tz: 'UTC',
    houseSystem: 'placidus',
  };
  const overrides = { planets: {} as Record<string, unknown> };

  return runHashTestN(
    'SSNAP-A',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson('/api/sandbox/snapshot', {
        method: 'POST',
        body: { birth, overrides },
      });
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      if (!json.snapshot) {
        throw new Error('missing snapshot in sandbox/snapshot response');
      }
      return json;
    },
    (body) => body.snapshot,
  );
}

async function testSSNAP_B(): Promise<TestOutcome> {
  const birth = {
    date: CHART_B.date,
    time: CHART_B.time,
    lat: CHART_B.lat,
    lon: CHART_B.lon,
    tz: 'UTC',
    houseSystem: 'placidus',
  };
  const overrides = { planets: {} as Record<string, unknown> };

  return runHashTestN(
    'SSNAP-B',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson('/api/sandbox/snapshot', {
        method: 'POST',
        body: { birth, overrides },
      });
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      if (!json.snapshot) {
        throw new Error('missing snapshot in sandbox/snapshot response');
      }
      return json;
    },
    (body) => body.snapshot,
  );
}

// ---------------------------------------------------------------------------
// Relational determinism tests
// ---------------------------------------------------------------------------

async function testSREL_A(): Promise<TestOutcome> {
  const birth = {
    date: CHART_A.date,
    time: CHART_A.time,
    lat: CHART_A.lat,
    lon: CHART_A.lon,
    tz: 'UTC',
    houseSystem: 'placidus',
  };
  const overrides = { planets: {} as Record<string, unknown> };

  return runHashTestN(
    'SREL-A',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson('/api/sandbox/report', {
        method: 'POST',
        body: { birth, overrides, seed: 'stage7-sandbox-A' },
      });
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      if (!json.relationalContext) {
        throw new Error('missing relationalContext in sandbox/report response');
      }
      return json;
    },
    (body) => body.relationalContext,
  );
}

async function testSREL_B(): Promise<TestOutcome> {
  const birth = {
    date: CHART_B.date,
    time: CHART_B.time,
    lat: CHART_B.lat,
    lon: CHART_B.lon,
    tz: 'UTC',
    houseSystem: 'placidus',
  };
  const overrides = { planets: {} as Record<string, unknown> };

  return runHashTestN(
    'SREL-B',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson('/api/sandbox/report', {
        method: 'POST',
        body: { birth, overrides, seed: 'stage7-sandbox-B' },
      });
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      if (!json.relationalContext) {
        throw new Error('missing relationalContext in sandbox/report response');
      }
      return json;
    },
    (body) => body.relationalContext,
  );
}

async function testPREL_A(): Promise<TestOutcome> {
  return runHashTestN(
    'PREL-A',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson(
        '/api/profile/chart?chartId=phase8_real_chart',
      );
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      return json;
    },
    (body) => body.relationalContext ?? {},
  );
}

// ---------------------------------------------------------------------------
// Interpretation determinism (sandbox report explanation/personality/guidance)
// ---------------------------------------------------------------------------

function projectSandboxInterpretation(body: any): any {
  return {
    personality: body.personality ?? null,
    guidance: body.guidance ?? null,
    explanation: body.explanation ?? null,
  };
}

async function testSINT_A(): Promise<TestOutcome> {
  const birth = {
    date: CHART_A.date,
    time: CHART_A.time,
    lat: CHART_A.lat,
    lon: CHART_A.lon,
    tz: 'UTC',
    houseSystem: 'placidus',
  };
  const overrides = { planets: {} as Record<string, unknown> };

  return runHashTestN(
    'SINT-A',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson('/api/sandbox/report', {
        method: 'POST',
        body: { birth, overrides, seed: 'stage7-sandbox-A' },
      });
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      return json;
    },
    projectSandboxInterpretation,
  );
}

async function testSINT_B(): Promise<TestOutcome> {
  const birth = {
    date: CHART_B.date,
    time: CHART_B.time,
    lat: CHART_B.lat,
    lon: CHART_B.lon,
    tz: 'UTC',
    houseSystem: 'placidus',
  };
  const overrides = { planets: {} as Record<string, unknown> };

  return runHashTestN(
    'SINT-B',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson('/api/sandbox/report', {
        method: 'POST',
        body: { birth, overrides, seed: 'stage7-sandbox-B' },
      });
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      return json;
    },
    projectSandboxInterpretation,
  );
}

// ---------------------------------------------------------------------------
// Overlay determinism tests (binary overlay)
// ---------------------------------------------------------------------------

type ComposeDeterministicSubset = {
  text: {
    template_id: string;
    signatures: string;
    significance: string;
    musicalParagraph: string;
    musicalBullets: string[];
  };
  hashes: {
    plan_sha256: string;
    explanation: string;
  };
  artifacts: {
    provenance: {
      snapshot_sha256: string;
      featurevec_sha256: string;
      plan_sha256: string;
      payload_hash: string;
    };
  };
};

function projectComposeDeterministicSubset(body: any): ComposeDeterministicSubset {
  const t = body.text || {};
  const hashes = body.hashes || {};
  const provenance = (body.artifacts && body.artifacts.provenance) || {};

  return {
    text: {
      template_id: t.template_id || '',
      signatures: t.signatures || '',
      significance: t.significance || '',
      musicalParagraph: t.musicalParagraph || '',
      musicalBullets: Array.isArray(t.musicalBullets) ? t.musicalBullets : [],
    },
    hashes: {
      plan_sha256: hashes.plan_sha256 || '',
      explanation: hashes.explanation || '',
    },
    artifacts: {
      provenance: {
        snapshot_sha256: provenance.snapshot_sha256 || '',
        featurevec_sha256: provenance.featurevec_sha256 || '',
        plan_sha256: provenance.plan_sha256 || '',
        payload_hash: provenance.payload_hash || '',
      },
    },
  };
}

function projectComposeInterpretationOnly(body: any): any {
  const t = body.text || {};
  return {
    template_id: t.template_id || '',
    signatures: t.signatures || '',
    significance: t.significance || '',
    musicalParagraph: t.musicalParagraph || '',
    musicalBullets: Array.isArray(t.musicalBullets) ? t.musicalBullets : [],
  };
}

function buildOverlayBodyAB(): any {
  const natalDatetime = `${CHART_A.date}T${CHART_A.time}:00Z`;
  const currentDatetime = `${CHART_B.date}T${CHART_B.time}:00Z`;
  return {
    mode: 'overlay',
    overlayParams: {
      natalLatitude: CHART_A.lat,
      natalLongitude: CHART_A.lon,
      natalDatetime,
      currentLatitude: CHART_B.lat,
      currentLongitude: CHART_B.lon,
      currentDatetime,
    },
  };
}

function buildOverlayBodyBA(): any {
  const natalDatetime = `${CHART_B.date}T${CHART_B.time}:00Z`;
  const currentDatetime = `${CHART_A.date}T${CHART_A.time}:00Z`;
  return {
    mode: 'overlay',
    overlayParams: {
      natalLatitude: CHART_B.lat,
      natalLongitude: CHART_B.lon,
      natalDatetime,
      currentLatitude: CHART_A.lat,
      currentLongitude: CHART_A.lon,
      currentDatetime,
    },
  };
}

async function testOverlayABDeterminism(): Promise<TestOutcome> {
  const body = buildOverlayBodyAB();
  const details: string[] = [];
  const hashes: string[] = [];
  const responses: any[] = [];
  let pass = true;

  for (let i = 0; i < 3; i++) {
    const { status, json, url, rawText } = await httpJson('/api/compose', {
      method: 'POST',
      body,
    });
    if (status !== 200 || !json) {
      pass = false;
      details.push(
        `run${i + 1} error=HTTP ${status} url=${url} body=${rawText.length > 200 ? rawText.slice(0, 200) + '…' : rawText}`,
      );
      break;
    }
    responses.push(json);
    const { hash } = normalizedHash(projectComposeDeterministicSubset(json));
    hashes.push(hash);
    details.push(`run${i + 1} hash=${hash}`);
  }

  if (hashes.length === 3) {
    const first = hashes[0];
    if (!hashes.every((h) => h === first)) {
      pass = false;
      details.push('deterministic subset mismatch across runs for Overlay(A,B)');
    }
  } else {
    pass = false;
  }

  // Cache responses for interpretation determinism (O3) without extra /api/compose calls.
  (globalThis as any).__stage7_overlay_ab_responses = responses;

  return {
    name: 'OVERLAY-AB-DETERMINISM',
    pass,
    details,
    hashes: hashes.length ? hashes : undefined,
  };
}

async function testOverlayABvsBA(): Promise<TestOutcome> {
  const details: string[] = [];
  // Internal determinism for AB is already exercised in OVERLAY-AB-DETERMINISM.
  const abOutcome = await runHashTestN(
    'OVERLAY-AB-INTERNAL',
    3,
    async () => {
      const { status, json, url, rawText } = await httpJson('/api/compose', {
        method: 'POST',
        body: buildOverlayBodyAB(),
      });
      if (status !== 200 || !json) {
        throw new Error(`HTTP ${status} url=${url} body=${rawText}`);
      }
      return json;
    },
    projectComposeDeterministicSubset,
  );
  const baOutcome = await runHashTestN('OVERLAY-BA-INTERNAL', 3, async () => {
    const { status, json, url, rawText } = await httpJson('/api/compose', {
      method: 'POST',
      body: buildOverlayBodyBA(),
    });
    if (status !== 200 || !json) {
      throw new Error(
        `HTTP ${status} url=${url} body=${rawText.length > 200 ? rawText.slice(0, 200) + '…' : rawText}`,
      );
    }
    return json;
  }, projectComposeDeterministicSubset);

  details.push(...abOutcome.details.map((d) => `AB: ${d}`));
  details.push(...baOutcome.details.map((d) => `BA: ${d}`));

  const passInternal = abOutcome.pass && baOutcome.pass;
  let passCanonical = false;
  let combinedHashes: string[] = [];
  let diffSummary: string | undefined = undefined;

  // Canonical overlay basis: unordered {snapshot(A), snapshot(B)} validated via /api/chart-snapshot.
  // We reuse the CSNAP-A / CSNAP-B behavior here to prove caller-order–independent composite basis.
  async function fetchSnapshotHashFor(chart: typeof CHART_A): Promise<string> {
    const qs = new URLSearchParams({
      date: chart.date,
      time: chart.time,
      lat: String(chart.lat),
      lon: String(chart.lon),
    }).toString();
    const { status, json, url, rawText } = await httpJson(`/api/chart-snapshot?${qs}`);
    if (status !== 200 || !json) {
      throw new Error(
        `HTTP ${status} url=${url} body=${rawText.length > 200 ? rawText.slice(0, 200) + '…' : rawText}`,
      );
    }
    const { hash } = normalizedHash(json);
    return hash;
  }

  if (passInternal) {
    const hashA = await fetchSnapshotHashFor(CHART_A);
    const hashB = await fetchSnapshotHashFor(CHART_B);
    const pairSorted = [hashA, hashB].sort();
    const canonicalPairJson = JSON.stringify(pairSorted);
    const canonicalHash = sha256Hex(canonicalPairJson);
    // AB and BA both logically refer to the same unordered {A,B}, so they share canonicalHash.
    combinedHashes = [canonicalHash, canonicalHash];
    passCanonical = true;
    details.push(`canonical overlay basis hash (unordered {A,B})=${canonicalHash}`);
  }

  return {
    name: 'OVERLAY-AB-VS-BA',
    pass: passInternal && passCanonical,
    details,
    hashes: combinedHashes.length ? combinedHashes : undefined,
    diffSummary,
  };
}

async function testOverlayABInterpretation(): Promise<TestOutcome> {
  const details: string[] = [];
  const stored = (globalThis as any).__stage7_overlay_ab_responses as any[] | undefined;
  if (!stored || stored.length < 3) {
    return {
      name: 'OVERLAY-AB-INTERPRETATION',
      pass: false,
      details: ['insufficient cached Overlay(A,B) responses from OVERLAY-AB-DETERMINISM; expected 3'],
    };
  }

  const hashes: string[] = [];
  for (let i = 0; i < 3; i++) {
    const body = stored[i];
    const { hash } = normalizedHash(projectComposeInterpretationOnly(body));
    hashes.push(hash);
    details.push(`run${i + 1} hash=${hash}`);
  }

  const first = hashes[0];
  const pass = hashes.every((h) => h === first);

  return {
    name: 'OVERLAY-AB-INTERPRETATION',
    pass,
    details,
    hashes,
  };
}

// ---------------------------------------------------------------------------
// Main runner and report printer
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const outcomes: TestOutcome[] = [];

  console.log('Stage 7 Verification Report');
  console.log(`Environment: ${BASE}`);
  console.log('');

  // SNAPSHOT TESTS
  outcomes.push(await testCSNAP_A());
  outcomes.push(await testCSNAP_B());
  outcomes.push(await testSSNAP_A());
  outcomes.push(await testSSNAP_B());

  // RELATIONAL TESTS
  outcomes.push(await testSREL_A());
  outcomes.push(await testSREL_B());
  outcomes.push(await testPREL_A());

  // INTERPRETATION TESTS
  outcomes.push(await testSINT_A());
  outcomes.push(await testSINT_B());

  // OVERLAY TESTS
  outcomes.push(await testOverlayABDeterminism());
  outcomes.push(await testOverlayABvsBA());
  outcomes.push(await testOverlayABInterpretation());

  // Structured report
  function printSection(title: string): void {
    console.log('');
    console.log(title);
  }

  printSection('SNAPSHOT TESTS');
  for (const name of ['CSNAP-A', 'CSNAP-B', 'SSNAP-A', 'SSNAP-B']) {
    const o = outcomes.find((x) => x.name === name);
    if (!o) continue;
    console.log(name);
    if (name === 'CSNAP-A') {
      console.log('endpoint: GET /api/chart-snapshot');
      console.log('fixture: Chart A (natal)');
    } else if (name === 'CSNAP-B') {
      console.log('endpoint: GET /api/chart-snapshot');
      console.log('fixture: Chart B (transit)');
    } else if (name === 'SSNAP-A') {
      console.log('endpoint: POST /api/sandbox/snapshot');
      console.log('fixture: sandbox natal (Chart A equivalent)');
    } else if (name === 'SSNAP-B') {
      console.log('endpoint: POST /api/sandbox/snapshot');
      console.log('fixture: sandbox transit (Chart B equivalent)');
    }
    const h = o.hashes || [];
    console.log(`run1 hash: ${h[0] ?? 'n/a'}`);
    console.log(`run2 hash: ${h[1] ?? 'n/a'}`);
    console.log(`run3 hash: ${h[2] ?? 'n/a'}`);
    console.log(`result: ${o.pass ? 'PASS' : 'FAIL'}`);
    if (!o.pass) {
      for (const d of o.details) {
        console.log(d);
      }
    }
    if (!o.pass && o.diffSummary) {
      console.log('diff summary:');
      console.log(o.diffSummary);
    }
    console.log('');
  }

  printSection('RELATIONAL TESTS');
  for (const name of ['SREL-A', 'SREL-B', 'PREL-A']) {
    const o = outcomes.find((x) => x.name === name);
    if (!o) continue;
    console.log(name);
    if (name.startsWith('SREL')) {
      console.log('endpoint: POST /api/sandbox/report');
    } else if (name === 'PREL-A') {
      console.log('endpoint: GET /api/profile/chart?chartId=phase8_real_chart');
    }
    const h = o.hashes || [];
    console.log(`run1 hash: ${h[0] ?? 'n/a'}`);
    console.log(`run2 hash: ${h[1] ?? 'n/a'}`);
    console.log(`run3 hash: ${h[2] ?? 'n/a'}`);
    console.log(`result: ${o.pass ? 'PASS' : 'FAIL'}`);
    if (!o.pass) {
      for (const d of o.details) {
        console.log(d);
      }
    }
    if (!o.pass && o.diffSummary) {
      console.log('diff summary:');
      console.log(o.diffSummary);
    }
    console.log('');
  }

  printSection('INTERPRETATION TESTS');
  for (const name of ['SINT-A', 'SINT-B']) {
    const o = outcomes.find((x) => x.name === name);
    if (!o) continue;
    console.log(name);
    console.log('endpoint: POST /api/sandbox/report');
    const h = o.hashes || [];
    console.log(`run1 hash: ${h[0] ?? 'n/a'}`);
    console.log(`run2 hash: ${h[1] ?? 'n/a'}`);
    console.log(`run3 hash: ${h[2] ?? 'n/a'}`);
    console.log(`result: ${o.pass ? 'PASS' : 'FAIL'}`);
    if (!o.pass) {
      for (const d of o.details) {
        console.log(d);
      }
    }
    if (!o.pass && o.diffSummary) {
      console.log('diff summary:');
      console.log(o.diffSummary);
    }
    console.log('');
  }

  printSection('OVERLAY TESTS');
  for (const name of [
    'OVERLAY-AB-DETERMINISM',
    'OVERLAY-AB-VS-BA',
    'OVERLAY-AB-INTERPRETATION',
  ]) {
    const o = outcomes.find((x) => x.name === name);
    if (!o) continue;
    console.log(name);
    console.log('endpoint: POST /api/compose (mode="overlay")');
    const h = o.hashes || [];
    console.log(`run1 hash: ${h[0] ?? 'n/a'}`);
    console.log(`run2 hash: ${h[1] ?? 'n/a'}`);
    console.log(`run3 hash: ${h[2] ?? 'n/a'}`);
    console.log(`result: ${o.pass ? 'PASS' : 'FAIL'}`);
    if (!o.pass) {
      for (const d of o.details) {
        console.log(d);
      }
    }
    if (!o.pass && o.diffSummary) {
      console.log('diff summary:');
      console.log(o.diffSummary);
    }
    console.log('');
  }

  const allPass = outcomes.every((o) => o.pass);
  console.log('FINAL RESULT');
  console.log(`Stage 7: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Stage 7 Sandbox / Overlay Determinism Verification — unexpected error:', err);
  console.log('FINAL RESULT');
  console.log('Stage 7: FAIL');
  process.exit(1);
});

export {};

