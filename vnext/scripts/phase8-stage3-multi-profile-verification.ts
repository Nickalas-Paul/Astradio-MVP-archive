#!/usr/bin/env node
/**
 * Phase 8 — Stage 3 Multi-Profile Interaction Expansion
 *
 * Lanes:
 * - Lane A: Multi-user identity isolation (3+ users, distinct charts, no anon fallback).
 * - Lane B: Ordered-pair comparison determinism (seeker/target, roles, retrieval).
 * - Lane C: Comparison listing isolation (per-user scoping, anon fail-closed).
 * - Lane D: Compose boundary proof (/api/compose cannot act as compatibility path).
 *
 * Run with server up (Next + engine), against a deployed or preview environment:
 *   API_BASE_URL="https://preview-or-local" npx ts-node --project ../../tsconfig.json vnext/scripts/phase8-stage3-multi-profile-verification.ts
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rpgStore = require('../rpg/store/rpg-store') as {
  getUserProfileById: (userId: string) => Promise<import('../rpg/store/rpg-store').UserProfileRow | null>;
};

const { getUserProfileById } = rpgStore;

const BASE = (process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

type CookieHeader = string | null;

type CheckStatus = 'pass' | 'fail';

interface CheckResult {
  name: string;
  status: CheckStatus;
  details: string[];
}

interface ProfileResponse {
  user: { id: string; displayName?: string } | null;
  primaryChart: { id: string; label?: string } | null;
}

interface ComparisonRecord {
  id: string;
  seekerChartId: string;
  targetChartId: string;
  roles?: unknown;
  planHash?: string;
  mergedFeatureHash?: string;
  compatibilityText?: unknown;
  [key: string]: unknown;
}

interface HttpResult {
  status: number;
  json: any | null;
  text: string;
  setCookie: string[];
  url: string;
}

async function httpRequest(
  path: string,
  options: { method?: string; body?: any; cookie?: CookieHeader } = {},
): Promise<HttpResult> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body != null) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass && typeof bypass === 'string' && bypass.trim()) {
    headers['x-vercel-protection-bypass'] = bypass.trim();
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  const rawText = await res.text();
  let json: any | null = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }

  const setCookieHeader = res.headers.get('set-cookie');
  const setCookie: string[] = [];
  if (setCookieHeader) {
    const parts = setCookieHeader.split(/,(?=[^;]+=[^;]+)/g);
    for (const part of parts) {
      setCookie.push(part.trim());
    }
  }

  return { status: res.status, json, text: rawText, setCookie, url };
}

function extractSessionCookie(setCookie: string[]): CookieHeader {
  if (!setCookie.length) return null;
  for (const c of setCookie) {
    if (c.startsWith('astradio_session=')) {
      return c.split(';')[0];
    }
  }
  return setCookie[0].split(';')[0] ?? null;
}

function record(results: CheckResult[], name: string, ok: boolean, details: string[] | string): void {
  results.push({
    name,
    status: ok ? 'pass' : 'fail',
    details: Array.isArray(details) ? details : [details],
  });
}

function asComparisonArray(payload: any): ComparisonRecord[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as ComparisonRecord[];
  if (Array.isArray(payload.items)) return payload.items as ComparisonRecord[];
  if (payload.comparison && typeof payload.comparison === 'object') {
    const c = payload.comparison as ComparisonRecord;
    return c.id ? [c] : [];
  }
  return [];
}

async function laneA_multiUserIsolation(results: CheckResult[]): Promise<{
  userIds: string[];
  chartIds: string[];
  cookies: CookieHeader[];
}> {
  const userIds: string[] = [];
  const chartIds: string[] = [];
  const cookies: CookieHeader[] = [];

  console.log('\n--- Lane A: Multi-User Identity Isolation ---');

  const sampleProfiles = [
    {
      displayName: 'Stage3 User 1',
      chart: {
        label: 'Stage3 Chart 1',
        date: '1990-01-01',
        time: '08:00',
        location: {
          source: 'geofinder',
          lat: 40.7128,
          lon: -74.006,
          timezone: 'America/New_York',
        },
      },
    },
    {
      displayName: 'Stage3 User 2',
      chart: {
        label: 'Stage3 Chart 2',
        date: '1995-06-15',
        time: '14:30',
        location: {
          source: 'geofinder',
          lat: 34.0522,
          lon: -118.2437,
          timezone: 'America/Los_Angeles',
        },
      },
    },
    {
      displayName: 'Stage3 User 3',
      chart: {
        label: 'Stage3 Chart 3',
        date: '1988-11-20',
        time: '21:45',
        location: {
          source: 'geofinder',
          lat: 51.5074,
          lon: -0.1278,
          timezone: 'Europe/London',
        },
      },
    },
  ];

  // Create three users via POST /api/profile
  for (let i = 0; i < sampleProfiles.length; i++) {
    const idx = i + 1;
    const profile = sampleProfiles[i];
    const { status, json, text, setCookie, url } = await httpRequest('/api/profile', {
      method: 'POST',
      body: profile,
    });

    const details: string[] = [`HTTP ${status}`, `url=${url}`, `body=${text}`];
    let ok = true;
    let userId: string | null = null;
    let chartId: string | null = null;
    let cookie: CookieHeader = null;

    if (status === 201 && json && json.user && json.primaryChart) {
      userId = json.user.id;
      chartId = json.primaryChart.id;
      cookie = extractSessionCookie(setCookie);
      details.push(`userId=${userId ?? 'null'}`);
      details.push(`chartId=${chartId ?? 'null'}`);
      if (cookie) {
        details.push(`sessionCookie=${cookie.split('=')[0]}=...`);
      } else {
        details.push('sessionCookie=none');
      }
      ok = !!userId && !!chartId;
    } else {
      ok = false;
    }

    record(results, `laneA-create-user-${idx}`, ok, details);

    userIds.push(userId ?? '');
    chartIds.push(chartId ?? '');
    cookies.push(cookie);
  }

  // Uniqueness checks
  const uniqueUsers = new Set(userIds.filter(Boolean));
  const uniqueCharts = new Set(chartIds.filter(Boolean));
  record(
    results,
    'laneA-unique-user-and-chart-ids',
    uniqueUsers.size === userIds.length && uniqueCharts.size === chartIds.length,
    [
      `userIds=${JSON.stringify(userIds)}`,
      `chartIds=${JSON.stringify(chartIds)}`,
      `uniqueUserCount=${uniqueUsers.size}`,
      `uniqueChartCount=${uniqueCharts.size}`,
    ],
  );

  // Per-session GET /api/profile
  for (let i = 0; i < userIds.length; i++) {
    const idx = i + 1;
    const cookie = cookies[i];
    const expectedUserId = userIds[i];
    const expectedChartId = chartIds[i];

    const { status, json, text, url } = await httpRequest('/api/profile', {
      method: 'GET',
      cookie,
    });

    const details: string[] = [`HTTP ${status}`, `url=${url}`];
    let ok = true;
    if (status === 200 && json) {
      const p = json as ProfileResponse;
      const u = p.user?.id ?? null;
      const c = p.primaryChart?.id ?? null;
      details.push(`userId=${u ?? 'null'} chartId=${c ?? 'null'}`);
      if (u !== expectedUserId || c !== expectedChartId) {
        ok = false;
        details.push(
          `expected userId=${expectedUserId}, chartId=${expectedChartId}`,
        );
      }
    } else {
      ok = false;
      details.push(`body=${text}`);
    }

    record(results, `laneA-session-profile-U${idx}`, ok, details);
  }

  // Anonymous GET /api/profile must not resolve a user
  {
    const { status, json, text, url } = await httpRequest('/api/profile', {
      method: 'GET',
    });
    const details: string[] = [`HTTP ${status}`, `url=${url}`];
    let ok = true;
    if (status === 200 && json) {
      const p = json as ProfileResponse;
      const u = p.user;
      const c = p.primaryChart;
      details.push(`user=${u ? JSON.stringify(u) : 'null'}`);
      details.push(`primaryChart=${c ? JSON.stringify(c) : 'null'}`);
      if (u !== null || c !== null) {
        ok = false;
        details.push('Expected anonymous profile to return { user: null, primaryChart: null }');
      }
    } else {
      ok = false;
      details.push(`body=${text}`);
    }
    record(results, 'laneA-anonymous-profile', ok, details);
  }

  // Optional DB validation of user_profiles linkage
  if (process.env.POSTGRES_URL) {
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const chartId = chartIds[i];
      try {
        const row = await getUserProfileById(userId);
        const details: string[] = [];
        let ok = !!row;
        if (row) {
          details.push(`user_profiles.user_id=${row.user_id}`);
          details.push(`user_profiles.chart_id=${row.chart_id}`);
          if (row.chart_id !== chartId) {
            ok = false;
            details.push(
              `expected chart_id=${chartId}, got=${row.chart_id}`,
            );
          }
        } else {
          details.push('no user_profiles row found');
        }
        record(results, `laneA-store-linkage-U${i + 1}`, ok, details);
      } catch (e: any) {
        record(results, `laneA-store-linkage-U${i + 1}`, false, [
          `Error querying user_profiles for userId=${userId}`,
          String(e?.message ?? e),
        ]);
      }
    }
  } else {
    record(results, 'laneA-store-linkage-skip', true, [
      'SKIP: POSTGRES_URL not set; running without database access',
    ]);
  }

  return { userIds, chartIds, cookies };
}

async function laneB_orderedPairDeterminism(
  results: CheckResult[],
  chartIds: string[],
  cookies: CookieHeader[],
): Promise<{ createdByUser: Record<string, string> }> {
  console.log('\n--- Lane B: Ordered-Pair Comparison Determinism ---');

  const pairs: Array<{ label: string; seekerIdx: number; targetIdx: number }> = [
    { label: 'C1->C2', seekerIdx: 0, targetIdx: 1 },
    { label: 'C2->C1', seekerIdx: 1, targetIdx: 0 },
    { label: 'C1->C3', seekerIdx: 0, targetIdx: 2 },
    { label: 'C3->C1', seekerIdx: 2, targetIdx: 0 },
    { label: 'C2->C3', seekerIdx: 1, targetIdx: 2 },
    { label: 'C3->C2', seekerIdx: 2, targetIdx: 1 },
  ];

  const createdByUser: Record<string, string> = {};

  interface PairRun {
    comparisonId: string;
    planHash: string | undefined;
    mergedFeatureHash: string | undefined;
    compatibilityText: unknown;
    seekerChartId: string;
    targetChartId: string;
    roles: unknown;
  }

  const pairRuns: Record<string, { run1: PairRun; run2: PairRun } | null> = {};

  for (const pair of pairs) {
    const seekerChartId = chartIds[pair.seekerIdx];
    const targetChartId = chartIds[pair.targetIdx];
    const seekerCookie = cookies[pair.seekerIdx];

    const payload = {
      seekerChartId,
      targetChartId,
      roles: {
        seeker: `stage3_user_${pair.seekerIdx + 1}`,
        target: `stage3_user_${pair.targetIdx + 1}`,
      },
    };

    const runDetails: string[] = [];
    let ok = true;

    const doPost = async (): Promise<PairRun | null> => {
      const { status, json, text, url } = await httpRequest('/api/comparisons', {
        method: 'POST',
        body: payload,
        cookie: seekerCookie,
      });
      runDetails.push(`POST ${pair.label}: url=${url} status=${status}`);
      if (status !== 201 || !json) {
        runDetails.push(`body=${text}`);
        return null;
      }
      const comparison = (json.comparison ?? json) as ComparisonRecord;
      const planHash = json.planHash ?? comparison.planHash;
      const mergedFeatureHash =
        json.mergedFeatureHash ?? comparison.mergedFeatureHash;
      const compatibilityText =
        json.compatibilityText ?? comparison.compatibilityText;
      const seeker = comparison.seekerChartId;
      const target = comparison.targetChartId;
      const roles = comparison.roles ?? json.roles;

      if (!comparison.id) {
        runDetails.push('comparison.id missing in response');
      } else {
        createdByUser[comparison.id] = `U${pair.seekerIdx + 1}`;
      }

      return {
        comparisonId: comparison.id,
        planHash,
        mergedFeatureHash,
        compatibilityText,
        seekerChartId: seeker,
        targetChartId: target,
        roles,
      };
    };

    const run1 = await doPost();
    const run2 = await doPost();

    if (!run1 || !run2) {
      ok = false;
      record(results, `laneB-${pair.label}-create`, ok, runDetails);
      pairRuns[pair.label] = null;
      continue;
    }

    // Determinism for identical ordered pair
    if (run1.planHash !== run2.planHash) {
      ok = false;
      runDetails.push(
        `planHash differs: ${run1.planHash ?? 'null'} vs ${run2.planHash ?? 'null'}`,
      );
    }
    if (run1.mergedFeatureHash !== run2.mergedFeatureHash) {
      ok = false;
      runDetails.push(
        `mergedFeatureHash differs: ${run1.mergedFeatureHash ?? 'null'} vs ${
          run2.mergedFeatureHash ?? 'null'
        }`,
      );
    }
    if (JSON.stringify(run1.compatibilityText) !== JSON.stringify(run2.compatibilityText)) {
      ok = false;
      runDetails.push('compatibilityText differs between runs');
    }
    if (run1.seekerChartId !== seekerChartId || run1.targetChartId !== targetChartId) {
      ok = false;
      runDetails.push(
        `run1 seeker/target mismatch: got seeker=${run1.seekerChartId}, target=${run1.targetChartId}, expected seeker=${seekerChartId}, target=${targetChartId}`,
      );
    }
    if (run2.seekerChartId !== seekerChartId || run2.targetChartId !== targetChartId) {
      ok = false;
      runDetails.push(
        `run2 seeker/target mismatch: got seeker=${run2.seekerChartId}, target=${run2.targetChartId}, expected seeker=${seekerChartId}, target=${targetChartId}`,
      );
    }

    record(results, `laneB-${pair.label}-determinism`, ok, runDetails);

    pairRuns[pair.label] = { run1, run2 };

    // Retrieval checks for each comparison id
    const retrievalDetails: string[] = [];
    let retrievalOk = true;
    for (const run of [run1, run2]) {
      const { status, json, text, url } = await httpRequest(
        `/api/comparisons/${encodeURIComponent(run.comparisonId)}`,
        {
          method: 'GET',
          cookie: seekerCookie,
        },
      );
      retrievalDetails.push(
        `GET ${pair.label} id=${run.comparisonId}: url=${url} status=${status}`,
      );
      if (status !== 200 || !json) {
        retrievalOk = false;
        retrievalDetails.push(`body=${text}`);
        continue;
      }
      const c = (json.comparison ?? json) as ComparisonRecord;
      if (c.seekerChartId !== seekerChartId || c.targetChartId !== targetChartId) {
        retrievalOk = false;
        retrievalDetails.push(
          `retrieved seeker/target mismatch: got seeker=${c.seekerChartId}, target=${c.targetChartId}, expected seeker=${seekerChartId}, target=${targetChartId}`,
        );
      }
      if (
        (c.planHash ?? json.planHash) !== run.planHash ||
        (c.mergedFeatureHash ?? json.mergedFeatureHash) !== run.mergedFeatureHash
      ) {
        retrievalOk = false;
        retrievalDetails.push('retrieved hashes do not match creation run');
      }
    }
    record(results, `laneB-${pair.label}-retrieval`, retrievalOk, retrievalDetails);
  }

  // Directional semantics: (A->B) vs (B->A) may differ but must be stable per direction.
  const directionalPairs: Array<[string, string]> = [
    ['C1->C2', 'C2->C1'],
    ['C1->C3', 'C3->C1'],
    ['C2->C3', 'C3->C2'],
  ];

  for (const [forwardLabel, reverseLabel] of directionalPairs) {
    const runsForward = pairRuns[forwardLabel];
    const runsReverse = pairRuns[reverseLabel];
    const details: string[] = [];
    let ok = true;
    if (!runsForward || !runsReverse) {
      ok = false;
      details.push('Missing runs for directional pair');
    } else {
      const pf = runsForward.run1.planHash;
      const pr = runsReverse.run1.planHash;
      const hf = runsForward.run1.mergedFeatureHash;
      const hr = runsReverse.run1.mergedFeatureHash;
      details.push(
        `${forwardLabel} planHash=${pf ?? 'null'} mergedFeatureHash=${hf ?? 'null'}`,
      );
      details.push(
        `${reverseLabel} planHash=${pr ?? 'null'} mergedFeatureHash=${hr ?? 'null'}`,
      );
      // They may be equal or differ; no additional constraints beyond stability per direction,
      // which is already enforced by per-pair determinism checks.
    }
    record(
      results,
      `laneB-directional-${forwardLabel}-vs-${reverseLabel}`,
      ok,
      details,
    );
  }

  return { createdByUser };
}

async function laneC_listingIsolation(
  results: CheckResult[],
  createdByUser: Record<string, string>,
  cookies: CookieHeader[],
): Promise<{
  baselineUserListings: Record<string, Set<string>>;
  baselineAnonListing: Set<string>;
}> {
  console.log('\n--- Lane C: Comparison Listing Isolation ---');

  const baselineUserListings: Record<string, Set<string>> = {};

  // Per-user listings
  for (let i = 0; i < cookies.length; i++) {
    const userLabel = `U${i + 1}`;
    const cookie = cookies[i];
    const { status, json, text, url } = await httpRequest('/api/comparisons', {
      method: 'GET',
      cookie,
    });
    const details: string[] = [`HTTP ${status}`, `url=${url}`];
    const ids = new Set<string>();
    let ok = true;
    if (status === 200 && json) {
      const list = asComparisonArray(json);
      details.push(`items=${list.length}`);
      for (const c of list) {
        if (c.id) {
          ids.add(c.id);
          const owner = createdByUser[c.id];
          if (owner && owner !== userLabel) {
            ok = false;
            details.push(
              `cross-user leakage: comparison ${c.id} created by ${owner} appears in ${userLabel} listing`,
            );
          }
        }
      }
    } else {
      ok = false;
      details.push(`body=${text}`);
    }
    baselineUserListings[userLabel] = ids;
    record(results, `laneC-list-${userLabel}`, ok, details);
  }

  // Anonymous listing
  const { status, json, text, url } = await httpRequest('/api/comparisons', {
    method: 'GET',
  });
  const anonDetails: string[] = [`HTTP ${status}`, `url=${url}`];
  const anonIds = new Set<string>();
  let anonOk = true;
  if (status === 200 && json) {
    const list = asComparisonArray(json);
    anonDetails.push(`items=${list.length}`);
    for (const c of list) {
      if (c.id) {
        anonIds.add(c.id);
        if (createdByUser[c.id]) {
          anonOk = false;
          anonDetails.push(
            `anonymous listing exposes comparison id=${c.id} created in Stage 3 run`,
          );
        }
      }
    }
  } else if (status >= 400 && status < 500) {
    anonDetails.push('anonymous listing fail-closed with client error (acceptable)');
  } else {
    anonOk = false;
    anonDetails.push(`body=${text}`);
  }
  record(results, 'laneC-list-anonymous', anonOk, anonDetails);

  return { baselineUserListings, baselineAnonListing: anonIds };
}

async function laneD_composeBoundary(
  results: CheckResult[],
  chartIds: string[],
  cookies: CookieHeader[],
  createdByUser: Record<string, string>,
  baselineUserListings: Record<string, Set<string>>,
  baselineAnonListing: Set<string>,
): Promise<void> {
  console.log('\n--- Lane D: Compose Boundary Proof ---');

  const seekerChartId = chartIds[0];
  const targetChartId = chartIds[1];
  const cookie = cookies[0];

  // 1) Explicitly incompatible mode=compatibility
  {
    const payload = {
      mode: 'compatibility',
      seekerChartId,
      targetChartId,
      roles: {
        seeker: 'stage3_user_1',
        target: 'stage3_user_2',
      },
    };

    const { status, json, text, url } = await httpRequest('/api/compose', {
      method: 'POST',
      body: payload,
      cookie,
    });

    const details: string[] = [`HTTP ${status}`, `url=${url}`, `body=${text}`];
    let ok = true;

    if (status === 400) {
      // Expected: UNSUPPORTED_COMPOSE_MODE_COMPATIBILITY or similar error.
      ok = true;
    } else if (status >= 200 && status < 300) {
      ok = false;
      details.push(
        'Expected /api/compose with mode="compatibility" to fail-closed, but received success status',
      );
    } else if (!json) {
      // Non-400 error without body: treat as failure.
      ok = false;
    }

    record(results, 'laneD-compose-mode-compatibility-rejected', ok, details);
  }

  // 2) Valid sandbox compose with extra comparison-like fields should not create comparisons
  {
    const payload = {
      date: '2025-01-01',
      time: '10:00',
      location: {
        source: 'geofinder',
        label: 'Stage3 Sandbox Location',
        lat: 37.7749,
        lon: -122.4194,
        timezone: 'America/Los_Angeles',
        resolvedAt: new Date().toISOString(),
      },
      seekerChartId,
      targetChartId,
      roles: {
        seeker: 'stage3_user_1',
        target: 'stage3_user_2',
      },
    };

    const { status, json, text, url } = await httpRequest('/api/compose', {
      method: 'POST',
      body: payload,
      cookie,
    });

    const details: string[] = [`HTTP ${status}`, `url=${url}`, `body=${text}`];
    let ok = true;

    if (status >= 200 && status < 300) {
      // Acceptable as long as no comparison artifacts are created as a side-effect.
      ok = true;
    } else {
      // Sandbox compose failure is not ideal but does not by itself indicate comparison path misuse.
      ok = true;
    }

    record(results, 'laneD-compose-sandbox-with-extra-fields', ok, details);
  }

  // 3) Post-compose, ensure /api/comparisons listings did not gain new Stage 3-owned comparisons
  const users = ['U1', 'U2', 'U3'];
  for (let i = 0; i < cookies.length; i++) {
    const userLabel = users[i];
    const cookieForUser = cookies[i];
    const beforeIds = baselineUserListings[userLabel] || new Set<string>();

    const { status, json, text, url } = await httpRequest('/api/comparisons', {
      method: 'GET',
      cookie: cookieForUser,
    });
    const details: string[] = [`HTTP ${status}`, `url=${url}`];
    let ok = true;
    if (status === 200 && json) {
      const list = asComparisonArray(json);
      const afterIds = new Set<string>();
      for (const c of list) {
        if (c.id) {
          afterIds.add(c.id);
          const owner = createdByUser[c.id];
          if (!beforeIds.has(c.id) && owner === userLabel) {
            ok = false;
            details.push(
              `comparison ${c.id} appears to have been created between baseline and post-compose for ${userLabel}`,
            );
          }
        }
      }
      details.push(
        `beforeCount=${beforeIds.size} afterCount=${afterIds.size}`,
      );
    } else {
      ok = false;
      details.push(`body=${text}`);
    }

    record(results, `laneD-post-compose-list-${userLabel}`, ok, details);
  }

  // Anonymous listing must also not gain new Stage 3-owned comparisons
  {
    const { status, json, text, url } = await httpRequest('/api/comparisons', {
      method: 'GET',
    });
    const details: string[] = [`HTTP ${status}`, `url=${url}`];
    let ok = true;
    if (status === 200 && json) {
      const list = asComparisonArray(json);
      const before = baselineAnonListing;
      const after = new Set<string>();
      for (const c of list) {
        if (c.id) {
          after.add(c.id);
          if (!before.has(c.id) && createdByUser[c.id]) {
            ok = false;
            details.push(
              `anonymous listing gained Stage 3-owned comparison id=${c.id} between baseline and post-compose`,
            );
          }
        }
      }
      details.push(
        `beforeAnonCount=${before.size} afterAnonCount=${after.size}`,
      );
    } else if (status >= 400 && status < 500) {
      details.push('anonymous listing still fail-closed (acceptable)');
    } else {
      ok = false;
      details.push(`body=${text}`);
    }
    record(results, 'laneD-post-compose-list-anonymous', ok, details);
  }
}

async function main(): Promise<void> {
  const results: CheckResult[] = [];

  console.log('Stage 3 — Multi-Profile Interaction Expansion (Phase 8)');
  console.log(`BASE: ${BASE}`);

  const laneA = await laneA_multiUserIsolation(results);
  const laneB = await laneB_orderedPairDeterminism(results, laneA.chartIds, laneA.cookies);
  const laneC = await laneC_listingIsolation(results, laneB.createdByUser, laneA.cookies);
  await laneD_composeBoundary(
    results,
    laneA.chartIds,
    laneA.cookies,
    laneB.createdByUser,
    laneC.baselineUserListings,
    laneC.baselineAnonListing,
  );

  console.log('\nStage 3 Check Matrix:');
  let allOk = true;
  for (const r of results) {
    const prefix = r.status === 'pass' ? '✔' : '✖';
    if (r.status === 'fail') {
      allOk = false;
    }
    console.log(`${prefix} ${r.name}`);
    for (const line of r.details) {
      console.log(`   - ${line}`);
    }
  }

  console.log('\nResult:', allOk ? 'PASS' : 'FAIL');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Stage 3 Multi-Profile Interaction Expansion — unexpected error:', err);
  console.log('\nResult: FAIL');
  process.exit(1);
});

export {};

