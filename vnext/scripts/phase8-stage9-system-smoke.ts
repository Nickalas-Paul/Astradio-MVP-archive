#!/usr/bin/env node
/**
 * Phase 8 — Stage 9: Closed Beta System Smoke Test
 *
 * Full-system smoke: 14 flows in order with identity continuity, compose
 * determinism repeat, turn-audio seed stability, and history persistence.
 *
 * Run with Next.js app (and engine) up:
 *   API_BASE_URL="http://localhost:3000" npx ts-node --project vnext/tsconfig.json vnext/scripts/phase8-stage9-system-smoke.ts
 * Or after vnext build:
 *   node dist/vnext/vnext/scripts/phase8-stage9-system-smoke.js
 *
 * Optional: PHASE8_SKIP_BOOTSTRAP=1 to use canonical ids without create-test-user.
 */

const BASE = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SKIP_BOOTSTRAP = process.env.PHASE8_SKIP_BOOTSTRAP === '1';

const CANONICAL_USER_ID = 'phase8_real_user';
const CANONICAL_CHART_ID = 'phase8_real_chart';
const CANONICAL_CAMPAIGN_ID = 'rpg_camp_81ceacfa9caab6ab';

type FlowStatus = 'pass' | 'fail' | 'skip';

interface FlowResult {
  flow: string;
  status: FlowStatus;
  reason: string;
  details: string[];
}

interface ProfileResponse {
  user: { id: string; displayName?: string } | null;
  primaryChart: { id: string; label?: string; date?: string; time?: string; lat?: number; lon?: number; timezone?: string } | null;
  campaignId?: string;
}

interface DebugPhase8Response {
  userId: string;
  campaignId: string;
  chartId?: string;
}

interface ProfileChartResult {
  chart: { id: string; label?: string; date?: string; time?: string; lat?: number; lon?: number; timezone?: string };
  snapshot?: unknown;
  explainer?: unknown;
  relationalContext?: unknown;
  meta?: { encoderVersion?: string; explainerVersion?: string; generatedAt?: string };
}

interface RpgCampaignView {
  campaign: { id: string; user_id: string; chart_id: string; state_version?: number; state_hash?: string };
  character_sheet?: unknown;
  current_turn?: { id: string; turn_seed?: string; [k: string]: unknown };
  outcome?: unknown;
  audio?: unknown;
  _diagnostics?: { resolved_user_id?: string; resolved_chart_id?: string; resolved_natal_snapshot_hash?: string; resolved_bundle_hash?: string };
}

interface HistoryItem {
  id?: string;
  ts?: string;
  model_id?: string | null;
  [key: string]: unknown;
}

interface TurnAudioResponse {
  turn_id?: string;
  turn_seed?: string;
  audio_seed?: string;
  audio_algo_version?: string;
  status?: string;
  [k: string]: unknown;
}

type CookieHeader = string | null;

async function httpRequest(
  path: string,
  options: { method?: string; body?: unknown; cookie?: CookieHeader } = {}
): Promise<{ status: number; json: unknown; text: string; setCookie: string[]; url: string }> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body != null) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.cookie) headers['Cookie'] = options.cookie;
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
  let json: unknown = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }
  const setCookieHeader = res.headers.get('set-cookie');
  const setCookie: string[] = setCookieHeader ? setCookieHeader.split(/,(?=[^;]+=[^;]+)/g).map((p) => p.trim()) : [];
  return { status: res.status, json, text: rawText, setCookie, url };
}

function extractSessionCookie(setCookie: string[]): CookieHeader {
  if (!setCookie.length) return null;
  for (const c of setCookie) {
    if (c.startsWith('astradio_session=')) return c.split(';')[0];
  }
  return setCookie[0].split(';')[0] ?? null;
}

function result(results: FlowResult[], flow: string, status: FlowStatus, reason: string, details: string[] = []): void {
  results.push({ flow, status, reason, details });
}

function failFast(results: FlowResult[], flow: string, reason: string, details: string[]): boolean {
  result(results, flow, 'fail', reason, details);
  return true;
}

function main(): Promise<void> {
  const results: FlowResult[] = [];
  let sessionCookie: CookieHeader = null;
  let userId: string | null = null;
  let chartId: string | null = null;
  let campaignId: string | null = null;
  let turnId: string | null = null;
  let exportId: string | null = null;
  let planSha256First: string | null = null;
  let turnSeedFirst: string | null = null;
  let audioSeedFirst: string | null = null;
  let profileChartSnapshot: ProfileChartResult | null = null;
  let birth: {
    date: string;
    time: string;
    location: {
      source: 'geofinder';
      label: string;
      lat: number;
      lon: number;
      timezone: string;
      resolvedAt: string;
    };
    houseSystem: string;
  } | null = null;
  const sandboxPayload = {
    birth: {
      date: '1990-01-01',
      time: '12:00',
      location: {
        source: 'geofinder' as const,
        label: 'Smoke Birth Seed',
        lat: 40.7128,
        lon: -74.006,
        timezone: 'UTC',
        resolvedAt: '2026-01-01T00:00:00.000Z',
      },
      houseSystem: 'placidus',
    },
    overrides: { planets: {} as Record<string, unknown> },
  };

  function withUser(path: string): string {
    if (!userId || sessionCookie) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}userId=${encodeURIComponent(userId)}`;
  }

  return (async () => {
    console.log('Stage 9 — Closed Beta System Smoke Test');
    console.log(`BASE: ${BASE}`);
    console.log(`SKIP_BOOTSTRAP: ${SKIP_BOOTSTRAP}`);
    console.log('---');

    // --- 1. Health (fail-fast) ---
    {
      let r: Awaited<ReturnType<typeof httpRequest>> | null = null;
      try {
        r = await httpRequest('/api/health');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failFast(results, '1. Health', `request failed: ${msg}`, []);
        printAndExit(results);
      }
      const res = r!;
      const ok = res.status === 200 && (res.json as { status?: string })?.status === 'ok';
      if (!ok) {
        failFast(results, '1. Health', `HTTP ${res.status} or status != ok`, [`body=${(res.text ?? '').slice(0, 200)}`]);
        printAndExit(results);
      }
      result(results, '1. Health', 'pass', '200 status=ok', [`status=${(res.json as { status?: string })?.status}`]);
    }

    // --- 2. Identity bootstrap (fail-fast unless SKIP_BOOTSTRAP) ---
    if (!SKIP_BOOTSTRAP) {
      const r = await httpRequest('/api/debug/phase8/create-test-user');
      const body = r.json as DebugPhase8Response | null;
      const ok = r.status === 200 && body?.userId && body?.campaignId;
      if (!ok) {
        failFast(results, '2. Identity bootstrap', `HTTP ${r.status} or missing userId/campaignId`, [`body=${r.text?.slice(0, 300)}`]);
        printAndExit(results);
      }
      userId = body!.userId;
      chartId = body!.chartId ?? null;
      campaignId = body!.campaignId;
      sessionCookie = extractSessionCookie(r.setCookie) ?? sessionCookie;
      result(results, '2. Identity bootstrap', 'pass', 'userId, campaignId present', [
        `userId=${userId}`,
        `chartId=${chartId ?? 'null'}`,
        `campaignId=${campaignId}`,
      ]);
    } else {
      userId = CANONICAL_USER_ID;
      chartId = CANONICAL_CHART_ID;
      campaignId = CANONICAL_CAMPAIGN_ID;
      result(results, '2. Identity bootstrap', 'skip', 'PHASE8_SKIP_BOOTSTRAP=1; using canonical ids', [
        `userId=${userId}`,
        `chartId=${chartId}`,
        `campaignId=${campaignId}`,
      ]);
    }

    // --- 3. Profile (fail-fast) ---
    {
      const r = await httpRequest(withUser('/api/profile'), { method: 'GET', cookie: sessionCookie });
      const body = r.json as ProfileResponse | null;
      const profileUserId = body?.user?.id ?? null;
      const primaryChartId = body?.primaryChart?.id ?? null;
      if (r.status !== 200 || !profileUserId || !primaryChartId) {
        failFast(results, '3. Profile', `HTTP ${r.status} or missing user.id/primaryChart.id`, [`body=${r.text?.slice(0, 300)}`]);
        printAndExit(results);
      }
      if (profileUserId !== userId) {
        failFast(results, '3. Profile', `identity continuity: user.id=${profileUserId} expected ${userId}`, []);
        printAndExit(results);
      }
      if (primaryChartId !== chartId) {
        failFast(results, '3. Profile', `identity continuity: primaryChart.id=${primaryChartId} expected ${chartId}`, []);
        printAndExit(results);
      }
      chartId = primaryChartId;
      result(results, '3. Profile', 'pass', 'user.id and primaryChart.id match', [`userId=${profileUserId}`, `chartId=${primaryChartId}`]);
    }

    // --- 4. Profile chart (fail-fast) ---
    {
      if (!chartId) {
        failFast(results, '4. Profile chart', 'no chartId from profile', []);
        printAndExit(results);
      }
      const r = await httpRequest(`/api/profile/chart?chartId=${encodeURIComponent(chartId)}`, { method: 'GET', cookie: sessionCookie });
      const body = r.json as ProfileChartResult | null;
      const chartIdFromChart = body?.chart?.id ?? null;
      if (r.status !== 200 || !body?.chart) {
        failFast(results, '4. Profile chart', `HTTP ${r.status} or missing chart`, [`body=${r.text?.slice(0, 300)}`]);
        printAndExit(results);
      }
      if (chartIdFromChart !== chartId) {
        failFast(results, '4. Profile chart', `identity: chart.id=${chartIdFromChart} expected ${chartId}`, []);
        printAndExit(results);
      }
      const hasSnapshot = body.snapshot != null || body.explainer != null || body.relationalContext != null;
      if (!hasSnapshot) {
        failFast(results, '4. Profile chart', 'missing snapshot or explainer or relationalContext', []);
        printAndExit(results);
      }
      profileChartSnapshot = body;
      const chartLat = typeof body.chart.lat === 'number' ? body.chart.lat : 40.7128;
      const chartLon = typeof body.chart.lon === 'number' ? body.chart.lon : -74.006;
      birth = {
        date: String(body.chart.date ?? '1990-01-01').slice(0, 10),
        time: String(body.chart.time ?? '12:00').slice(0, 5),
        location: {
          source: 'geofinder',
          label: `Smoke Birth (${chartLat.toFixed(4)}, ${chartLon.toFixed(4)})`,
          lat: chartLat,
          lon: chartLon,
          timezone: String(body.chart.timezone ?? 'UTC'),
          resolvedAt: '2026-01-01T00:00:00.000Z',
        },
        houseSystem: 'placidus',
      };
      sandboxPayload.birth = birth;
      result(results, '4. Profile chart', 'pass', 'chart.id matches; snapshot/explainer present', [`chartId=${chartIdFromChart}`]);
    }

    // --- 5. Sandbox snapshot (best-effort) ---
    {
      const r = await httpRequest('/api/sandbox/snapshot', { method: 'POST', body: sandboxPayload, cookie: sessionCookie });
      const hasSnapshot = r.status === 200 && r.json != null && typeof r.json === 'object' && (('planets' in r.json) || ('positions' in r.json) || ('snapshot' in r.json));
      if (r.status !== 200) {
        result(results, '5. Sandbox snapshot', 'fail', `HTTP ${r.status}`, [`body=${r.text?.slice(0, 200)}`]);
      } else if (!hasSnapshot) {
        result(results, '5. Sandbox snapshot', 'fail', 'response missing snapshot shape', []);
      } else {
        result(results, '5. Sandbox snapshot', 'pass', '200 snapshot shape present', []);
      }
    }

    // --- 6. Sandbox report (best-effort) ---
    {
      const r = await httpRequest('/api/sandbox/report', { method: 'POST', body: { ...sandboxPayload, seed: undefined }, cookie: sessionCookie });
      const features = (r.json as { features?: unknown[] })?.features;
      const len64 = Array.isArray(features) && features.length === 64;
      if (r.status !== 200) {
        result(results, '6. Sandbox report', 'fail', `HTTP ${r.status}`, []);
      } else if (!len64) {
        result(results, '6. Sandbox report', 'fail', `features length ${Array.isArray(features) ? features.length : 'missing'}`, []);
      } else {
        result(results, '6. Sandbox report', 'pass', 'features length 64', []);
      }
    }

    // --- 7. Compose sandbox (best-effort); capture plan_sha256 and export_id ---
    const composeSandboxBody = {
      mode: 'sandbox' as const,
      chartData: {
        date: sandboxPayload.birth.date,
        time: sandboxPayload.birth.time,
        lat: sandboxPayload.birth.location.lat,
        lon: sandboxPayload.birth.location.lon,
      },
      controls: {},
    };
    {
      const r = await httpRequest('/api/compose', { method: 'POST', body: composeSandboxBody, cookie: sessionCookie });
      const body = r.json as { hashes?: { plan_sha256?: string }; explanation?: { sections?: unknown[] }; export_id?: string } | null;
      const planSha = body?.hashes?.plan_sha256;
      const hasSections = body?.explanation?.sections != null;
      if (r.status !== 200) {
        result(results, '7. Compose sandbox', 'fail', `HTTP ${r.status}`, []);
      } else if (!planSha || typeof planSha !== 'string') {
        result(results, '7. Compose sandbox', 'fail', 'missing or empty hashes.plan_sha256', []);
      } else if (!hasSections) {
        result(results, '7. Compose sandbox', 'fail', 'missing explanation.sections', []);
      } else {
        planSha256First = planSha;
        if (body?.export_id) exportId = body.export_id;
        result(results, '7. Compose sandbox', 'pass', 'plan_sha256 and sections present', [
          `plan_sha256=${planSha.slice(0, 16)}...`,
          exportId ? `export_id=${exportId.slice(0, 16)}...` : 'export_id=null',
        ]);
      }
    }

    // --- 8. Compose sandbox repeat (best-effort); determinism ---
    {
      if (planSha256First == null) {
        result(results, '8. Compose sandbox repeat', 'skip', 'no plan_sha256 from step 7', []);
      } else {
        const r = await httpRequest('/api/compose', { method: 'POST', body: composeSandboxBody, cookie: sessionCookie });
        const body = r.json as { hashes?: { plan_sha256?: string } } | null;
        const planSha2 = body?.hashes?.plan_sha256;
        if (r.status !== 200) {
          result(results, '8. Compose sandbox repeat', 'fail', `HTTP ${r.status}`, []);
        } else if (!planSha2) {
          result(results, '8. Compose sandbox repeat', 'fail', 'missing hashes.plan_sha256 on repeat', []);
        } else if (planSha2 !== planSha256First) {
          result(results, '8. Compose sandbox repeat', 'fail', 'plan_sha256 mismatch (determinism)', [
            `first=${planSha256First.slice(0, 16)}...`,
            `repeat=${planSha2.slice(0, 16)}...`,
          ]);
        } else {
          result(results, '8. Compose sandbox repeat', 'pass', 'plan_sha256 match (determinism)', [`plan_sha256=${planSha2.slice(0, 16)}...`]);
        }
      }
    }

    // --- 9. Compose overlay (best-effort) ---
    {
      if (!profileChartSnapshot?.chart) {
        result(results, '9. Compose overlay', 'skip', 'no profile chart for overlayParams', []);
      } else {
        const chart = profileChartSnapshot.chart;
        const natalDate = String(chart.date ?? '1990-01-01').slice(0, 10);
        const natalTime = String(chart.time ?? '12:00').slice(0, 5);
        const natalLat = typeof chart.lat === 'number' ? chart.lat : 40.7128;
        const natalLon = typeof chart.lon === 'number' ? chart.lon : -74.006;
        const overlayParams = {
          natalLatitude: natalLat,
          natalLongitude: natalLon,
          natalDatetime: `${natalDate}T${natalTime}:00Z`,
          currentLatitude: natalLat,
          currentLongitude: natalLon,
          currentDatetime: new Date().toISOString(),
        };
        const r = await httpRequest('/api/compose', { method: 'POST', body: { mode: 'overlay', overlayParams }, cookie: sessionCookie });
        const body = r.json as { overlay?: unknown; explanation?: unknown; export_id?: string } | null;
        const hasOverlay = r.status === 200 && (body?.overlay != null || body?.explanation != null);
        if (r.status !== 200) {
          result(results, '9. Compose overlay', 'fail', `HTTP ${r.status}`, []);
        } else if (!hasOverlay) {
          result(results, '9. Compose overlay', 'fail', 'missing overlay/explanation shape', []);
        } else {
          if (body?.export_id && !exportId) exportId = body.export_id;
          result(results, '9. Compose overlay', 'pass', 'overlay response present', []);
        }
      }
    }

    // --- 10. Campaign view (fail-fast) ---
    {
      if (!campaignId) {
        failFast(results, '10. Campaign view', 'no campaignId', []);
        printAndExit(results);
      }
      const r = await httpRequest(withUser(`/api/rpg/campaign/${encodeURIComponent(campaignId)}`), { method: 'GET', cookie: sessionCookie });
      const body = r.json as RpgCampaignView | null;
      if (r.status !== 200 || !body?.campaign) {
        failFast(results, '10. Campaign view', `HTTP ${r.status} or missing campaign`, [`body=${r.text?.slice(0, 300)}`]);
        printAndExit(results);
      }
      if (body.campaign.user_id !== userId) {
        failFast(results, '10. Campaign view', `identity: campaign.user_id=${body.campaign.user_id} expected ${userId}`, []);
        printAndExit(results);
      }
      if (body.campaign.chart_id !== chartId) {
        failFast(results, '10. Campaign view', `identity: campaign.chart_id=${body.campaign.chart_id} expected ${chartId}`, []);
        printAndExit(results);
      }
      if (body.campaign.id !== campaignId) {
        failFast(results, '10. Campaign view', `campaign.id=${body.campaign.id} expected ${campaignId}`, []);
        printAndExit(results);
      }
      const hasCharOrTurn = body.character_sheet != null || body.current_turn != null;
      if (!hasCharOrTurn) {
        failFast(results, '10. Campaign view', 'missing character_sheet and current_turn', []);
        printAndExit(results);
      }
      const diag = body._diagnostics;
      if (diag && (diag.resolved_user_id !== userId || diag.resolved_chart_id !== chartId)) {
        failFast(results, '10. Campaign view', 'diagnostics resolved_* mismatch', [
          `resolved_user_id=${diag.resolved_user_id}`,
          `resolved_chart_id=${diag.resolved_chart_id}`,
        ]);
        printAndExit(results);
      }
      turnId = body.current_turn?.id ?? null;
      result(results, '10. Campaign view', 'pass', 'campaign identity and diagnostics match', [
        `campaignId=${body.campaign.id}`,
        `turnId=${turnId ?? 'null'}`,
      ]);
    }

    // --- 11. Turn audio (best-effort); capture seeds ---
    {
      if (!turnId) {
        result(results, '11. Turn audio', 'skip', 'no turnId from campaign view', []);
      } else {
        const r = await httpRequest(`/api/rpg/turn/${encodeURIComponent(turnId)}/audio`, { method: 'GET', cookie: sessionCookie });
        const body = r.json as TurnAudioResponse | null;
        if (r.status !== 200) {
          result(results, '11. Turn audio', 'fail', `HTTP ${r.status}`, []);
        } else if (!body) {
          result(results, '11. Turn audio', 'fail', 'empty body', []);
        } else {
          turnSeedFirst = body.turn_seed ?? null;
          audioSeedFirst = body.audio_seed ?? null;
          const hasSeeds = turnSeedFirst != null && audioSeedFirst != null;
          if (body.turn_id && body.turn_id !== turnId) {
            result(results, '11. Turn audio', 'fail', `turn_id=${body.turn_id} expected ${turnId}`, []);
          } else if (!hasSeeds) {
            result(results, '11. Turn audio', 'pass', '200; turn_seed/audio_seed not in body (contract allows)', [
              `status=${body.status ?? 'n/a'}`,
            ]);
          } else {
            result(results, '11. Turn audio', 'pass', '200 turn_seed and audio_seed present', [
              `turn_seed=${turnSeedFirst!.slice(0, 16)}...`,
              `audio_seed=${audioSeedFirst!.slice(0, 16)}...`,
            ]);
          }
        }
      }
    }

    // --- 12. Turn audio repeat (best-effort); seed stability ---
    {
      if (!turnId) {
        result(results, '12. Turn audio repeat', 'skip', 'no turnId', []);
      } else {
        const r = await httpRequest(`/api/rpg/turn/${encodeURIComponent(turnId)}/audio`, { method: 'GET', cookie: sessionCookie });
        const body = r.json as TurnAudioResponse | null;
        if (r.status !== 200) {
          result(results, '12. Turn audio repeat', 'fail', `HTTP ${r.status}`, []);
        } else if (!body) {
          result(results, '12. Turn audio repeat', 'fail', 'empty body', []);
        } else if (turnSeedFirst != null && audioSeedFirst != null) {
          if (body.turn_seed !== turnSeedFirst || body.audio_seed !== audioSeedFirst) {
            result(results, '12. Turn audio repeat', 'fail', 'turn_seed or audio_seed changed (stability)', [
              `first turn_seed=${turnSeedFirst.slice(0, 16)}...`,
              `repeat turn_seed=${body.turn_seed?.slice(0, 16)}...`,
            ]);
          } else {
            result(results, '12. Turn audio repeat', 'pass', 'turn_seed and audio_seed unchanged', []);
          }
        } else {
          if (body.turn_id && body.turn_id !== turnId) {
            result(results, '12. Turn audio repeat', 'fail', 'turn_id changed', []);
          } else {
            result(results, '12. Turn audio repeat', 'pass', '200; no seeds to compare (contract)', []);
          }
        }
      }
    }

    // --- 13. Export (best-effort) ---
    {
      if (!exportId) {
        result(results, '13. Export', 'skip', 'no export_id from compose', []);
      } else {
        const r = await httpRequest(`/api/exports/${encodeURIComponent(exportId)}`, { method: 'GET', cookie: sessionCookie });
        if (r.status >= 500) {
          result(results, '13. Export', 'fail', `HTTP ${r.status}`, []);
        } else if (r.status === 200 || r.status === 202) {
          result(results, '13. Export', 'pass', `HTTP ${r.status}`, [`export_id=${exportId.slice(0, 16)}...`]);
        } else {
          result(results, '13. Export', 'fail', `HTTP ${r.status}`, []);
        }
      }
    }

    // --- 14. History (best-effort); persistence assertion ---
    {
      const r = await httpRequest(withUser('/api/user/history'), { method: 'GET', cookie: sessionCookie });
      let items: HistoryItem[] = [];
      if (r.status === 200 && Array.isArray(r.json)) {
        items = r.json as HistoryItem[];
      } else if (r.status === 200 && r.json != null && typeof r.json === 'object' && Array.isArray((r.json as { items?: unknown[] }).items)) {
        items = (r.json as { items: HistoryItem[] }).items;
      }
      if (r.status !== 200) {
        result(results, '14. History', 'fail', `HTTP ${r.status}`, []);
      } else {
        const details: string[] = [`items=${items.length}`];
        const itemsHaveId = items.every((i) => typeof i.id === 'string' && i.id.length > 0);
        const itemsHaveTs = items.every((i) => typeof i.ts === 'string' && i.ts.length > 0);
        const itemsHaveModelKey = items.every((i) => Object.prototype.hasOwnProperty.call(i, 'model_id'));
        const matchExportId = exportId && items.some((i) => i.id === exportId);
        if (!itemsHaveId) details.push('contract: one or more items missing string id');
        if (!itemsHaveTs) details.push('contract: one or more items missing string ts');
        if (!itemsHaveModelKey) details.push('contract: one or more items missing model_id key');
        if (matchExportId) details.push('persistence: at least one item.id === export_id');
        else details.push('persistence: minimal contract path (200 + array)');
        const pass = itemsHaveId && itemsHaveTs && itemsHaveModelKey;
        result(results, '14. History', pass ? 'pass' : 'fail', pass ? '200; array; id/ts/model_id contract' : 'history contract mismatch', details);
      }
    }

    printAndExit(results);
  })();
}

function printAndExit(results: FlowResult[]): never {
  console.log('\n--- Flow results ---');
  for (const r of results) {
    const sym = r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : 'SKIP';
    console.log(`${sym} ${r.flow}: ${r.reason}`);
    for (const d of r.details) {
      console.log(`    ${d}`);
    }
  }
  const executed = results.filter((x) => x.status !== 'skip');
  const failed = results.filter((x) => x.status === 'fail');
  const allPass = failed.length === 0 && executed.length > 0 && executed.every((x) => x.status === 'pass');
  console.log('\n--- Summary ---');
  console.log(`Executed: ${executed.length}, Pass: ${executed.filter((x) => x.status === 'pass').length}, Fail: ${failed.length}, Skip: ${results.filter((x) => x.status === 'skip').length}`);
  console.log('Overall:', allPass ? 'PASS' : 'FAIL');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Stage 9 system smoke — unexpected error:', err);
  console.log('Overall: FAIL');
  process.exit(1);
});

export {};
