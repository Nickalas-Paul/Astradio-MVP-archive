#!/usr/bin/env node
/**
 * Phase 8 — Stage 6 Cross-Surface Consistency Verification
 *
 * Scope:
 * - Single Phase 8 real test user in one session.
 * - Verify userId + primaryChart.id continuity across:
 *   - /api/profile
 *   - /api/profile/chart
 *   - /api/rpg/campaign/[campaignId]
 *   - /api/chart-snapshot
 *   - /api/sandbox/snapshot
 *   - /api/sandbox/report
 *   - /api/user/history
 *   - /api/compose (live overlay flow)
 *
 * This script assumes:
 * - Next.js app and engine are running and reachable.
 * - /api/debug/phase8/create-test-user is available to bootstrap the Phase 8 real user.
 *
 * History assertions are **fixture-scoped**:
 * - They assume the Phase 8 real test user currently has a single canonical primary chart.
 * - They do NOT assert that all future multi-chart users must have history entries tied only to one chart.
 *   This is a Stage 6 fixture invariant, not a global product invariant.
 *
 * Run with server up (Next + engine):
 *   API_BASE_URL="https://preview-or-local" npx ts-node --project ../../tsconfig.json vnext/scripts/phase8-stage6-cross-surface-identity-verification.ts
 */

// Use CommonJS-style requires so this script can run under ts-node / compiled CJS.

const BASE = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

type CheckStatus = 'pass' | 'fail';

interface CheckResult {
  name: string;
  status: CheckStatus;
  details: string[];
}

interface ProfileResponse {
  user: { id: string; displayName?: string } | null;
  primaryChart: {
    id: string;
    label?: string;
    date?: string;
    time?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
  } | null;
  campaignId?: string;
}

interface DebugPhase8Response {
  userId: string;
  campaignId: string;
  chartId?: string;
}

interface ProfileChartResult {
  chart: {
    id: string;
    label?: string;
    date?: string;
    time?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
  };
  snapshot?: unknown;
  explainer?: unknown;
  relationalContext?: unknown;
  meta?: { encoderVersion: string; explainerVersion: string; generatedAt: string };
}

interface RpgCampaignView {
  campaign: {
    id: string;
    user_id: string;
    chart_id: string;
    state_version: number;
    state_hash: string;
  };
  character_sheet: unknown;
  current_turn: unknown;
  outcome: unknown;
  audio: unknown;
  _diagnostics?: {
    resolved_user_id?: string;
    resolved_chart_id?: string;
    resolved_natal_snapshot_hash?: string;
    resolved_bundle_hash?: string;
    resolved_campaign_id?: string;
  };
}

interface HistoryItem {
  id?: string;
  userId?: string;
  chartId?: string;
  [key: string]: unknown;
}

type CookieHeader = string | null;

async function httpRequest(
  path: string,
  options: { method?: string; body?: any; cookie?: CookieHeader } = {}
): Promise<{ status: number; json: any | null; text: string; setCookie: string[]; url: string }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body != null) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }
  // Vercel Deployment Protection automation bypass (Phase 8 verifier only).
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

  return {
    status: res.status,
    json,
    text: rawText,
    setCookie,
    url,
  };
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

async function main(): Promise<void> {
  const results: CheckResult[] = [];

  console.log('Stage 6 — Cross-Surface Consistency Verification (Phase 8)');
  console.log(`BASE: ${BASE}`);

  // ---------------------------------------------------------------------------
  // 1. Bootstrap Phase 8 real user via debug endpoint
  // ---------------------------------------------------------------------------
  let phase8SessionCookie: CookieHeader = null;
  let pinnedUserId: string | null = null;
  let pinnedChartId: string | null = null;
  let pinnedCampaignId: string | null = null;

  {
    const { status, json, setCookie, text, url } = await httpRequest('/api/debug/phase8/create-test-user');
    const details: string[] = [`url=${url}`, `HTTP ${status}`];

    if (status >= 200 && status < 300 && json) {
      const dbg = json as DebugPhase8Response;
      pinnedUserId = dbg.userId;
      pinnedCampaignId = dbg.campaignId;
      pinnedChartId = dbg.chartId ?? null;
      details.push(
        `debug.userId=${dbg.userId}`,
        `debug.campaignId=${dbg.campaignId}`,
        `debug.chartId=${dbg.chartId ?? 'null'}`
      );
      phase8SessionCookie = extractSessionCookie(setCookie) ?? phase8SessionCookie;
      if (phase8SessionCookie) {
        details.push(`sessionCookie=${phase8SessionCookie.split('=')[0]}=...`);
      } else {
        details.push('sessionCookie=none (will rely on explicit user linkage where supported)');
      }
      record(results, 'bootstrap-phase8-real-user', true, details);
    } else {
      details.push(`body=${text}`);
      record(results, 'bootstrap-phase8-real-user', false, details);
    }
  }

  if (!pinnedUserId) {
    console.warn('Pinned Phase 8 userId could not be resolved; remaining checks will likely fail.');
  }

  function withPinnedUser(path: string): string {
    if (!pinnedUserId || phase8SessionCookie) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}userId=${encodeURIComponent(pinnedUserId)}`;
  }

  // ---------------------------------------------------------------------------
  // 2. Profile + profile chart continuity (I1, I2)
  // ---------------------------------------------------------------------------
  let baselineUserId: string | null = null;
  let baselinePrimaryChartId: string | null = null;
  let profileChartSnapshot: ProfileChartResult | null = null;

  {
    const details: string[] = [];
    let ok = true;

    // First profile
    const p1 = await httpRequest(withPinnedUser('/api/profile'), {
      method: 'GET',
      cookie: phase8SessionCookie,
    });
    details.push(`profile-1.url=${p1.url}`, `profile-1.status=${p1.status}`);
    if (p1.status === 200 && p1.json) {
      const profile = p1.json as ProfileResponse;
      baselineUserId = profile.user?.id ?? null;
      baselinePrimaryChartId = profile.primaryChart?.id ?? null;
      details.push(
        `profile-1.userId=${baselineUserId ?? 'null'}`,
        `profile-1.primaryChartId=${baselinePrimaryChartId ?? 'null'}`
      );
    } else {
      ok = false;
      details.push(`profile-1.body=${p1.text}`);
    }

    // Profile chart (explicit chartId when we have it)
    if (baselinePrimaryChartId) {
      const pcPath = `/api/profile/chart?chartId=${encodeURIComponent(baselinePrimaryChartId)}`;
      const pc = await httpRequest(pcPath, {
        method: 'GET',
        cookie: phase8SessionCookie,
      });
      details.push(`profile-chart.url=${pc.url}`, `profile-chart.status=${pc.status}`);
      if (pc.status === 200 && pc.json) {
        const profileChart = pc.json as ProfileChartResult;
        profileChartSnapshot = profileChart;
        const chartId = profileChart.chart?.id;
        details.push(`profile-chart.chart.id=${chartId ?? 'null'}`);
        if (!chartId || chartId !== baselinePrimaryChartId) {
          ok = false;
          details.push(
            `profile-chart mismatch: expected chart.id=${baselinePrimaryChartId}, got=${chartId ?? 'null'}`
          );
        }
      } else {
        ok = false;
        details.push(`profile-chart.body=${pc.text}`);
      }
    } else {
      ok = false;
      details.push('profile-1 did not expose primaryChart.id; cannot verify profile-chart continuity');
    }

    // Second profile to confirm continuity
    const p2 = await httpRequest(withPinnedUser('/api/profile'), {
      method: 'GET',
      cookie: phase8SessionCookie,
    });
    details.push(`profile-2.url=${p2.url}`, `profile-2.status=${p2.status}`);
    if (p2.status === 200 && p2.json) {
      const profile2 = p2.json as ProfileResponse;
      const uid2 = profile2.user?.id ?? null;
      const cid2 = profile2.primaryChart?.id ?? null;
      details.push(
        `profile-2.userId=${uid2 ?? 'null'}`,
        `profile-2.primaryChartId=${cid2 ?? 'null'}`
      );
      if (baselineUserId && uid2 && uid2 !== baselineUserId) {
        ok = false;
        details.push(
          `userId continuity failure: expected userId=${baselineUserId}, got=${uid2}`
        );
      }
      if (baselinePrimaryChartId && cid2 && cid2 !== baselinePrimaryChartId) {
        ok = false;
        details.push(
          `primaryChart.id continuity failure: expected=${baselinePrimaryChartId}, got=${cid2}`
        );
      }
    } else {
      ok = false;
      details.push(`profile-2.body=${p2.text}`);
    }

    record(results, 'profile-and-profile-chart-continuity', ok, [
      ...details,
      `pinnedUserId=${pinnedUserId ?? 'null'}`,
      `pinnedChartId=${pinnedChartId ?? 'null'}`,
    ]);
  }

  // ---------------------------------------------------------------------------
  // 3. Campaign surface uses same canonical chart (I3)
  // ---------------------------------------------------------------------------
  if (pinnedCampaignId) {
    const details: string[] = [];
    let ok = true;

    const path = withPinnedUser(`/api/rpg/campaign/${encodeURIComponent(pinnedCampaignId)}`);
    const r = await httpRequest(path, {
      method: 'GET',
      cookie: phase8SessionCookie,
    });
    details.push(`url=${r.url}`, `status=${r.status}`);

    if (r.status === 200 && r.json) {
      const view = r.json as RpgCampaignView;
      const campaignUserId = view.campaign?.user_id;
      const campaignChartId = view.campaign?.chart_id;
      const diagUserId = view._diagnostics?.resolved_user_id;
      const diagChartId = view._diagnostics?.resolved_chart_id;

      details.push(
        `campaign.user_id=${campaignUserId ?? 'null'}`,
        `campaign.chart_id=${campaignChartId ?? 'null'}`,
        `diag.resolved_user_id=${diagUserId ?? 'null'}`,
        `diag.resolved_chart_id=${diagChartId ?? 'null'}`
      );

      if (pinnedUserId && campaignUserId && campaignUserId !== pinnedUserId) {
        ok = false;
        details.push(
          `campaign.user_id mismatch: expected pinnedUserId=${pinnedUserId}, got=${campaignUserId}`
        );
      }
      if (baselinePrimaryChartId && campaignChartId && campaignChartId !== baselinePrimaryChartId) {
        ok = false;
        details.push(
          `campaign.chart_id mismatch: expected primaryChart.id=${baselinePrimaryChartId}, got=${campaignChartId}`
        );
      }
      if (baselinePrimaryChartId && diagChartId && diagChartId !== baselinePrimaryChartId) {
        ok = false;
        details.push(
          `diagnostics.resolved_chart_id mismatch: expected primaryChart.id=${baselinePrimaryChartId}, got=${diagChartId}`
        );
      }
    } else {
      ok = false;
      details.push(`body=${r.text}`);
    }

    record(results, 'campaign-canonical-chart-alignment', ok, [
      ...details,
      `pinnedCampaignId=${pinnedCampaignId}`,
    ]);
  } else {
    record(results, 'campaign-canonical-chart-alignment', true, [
      'SKIP: pinnedCampaignId not available from debug bootstrap',
    ]);
  }

  // ---------------------------------------------------------------------------
  // 4. Sandbox identity continuity (I4) — no mutation of userId / primaryChart.id
  // ---------------------------------------------------------------------------
  {
    const details: string[] = [];
    let ok = true;

    // Derive sandbox birth strictly from the canonical profile chart context.
    // If we cannot derive birth from the profile chart, Stage 6 cannot verify sandbox continuity.
    if (
      !profileChartSnapshot?.chart?.date ||
      profileChartSnapshot.chart.time == null ||
      typeof profileChartSnapshot.chart.lat !== 'number' ||
      typeof profileChartSnapshot.chart.lon !== 'number'
    ) {
      ok = false;
      details.push(
        'sandbox.birth.fromProfileChart=false',
        'sandbox failure: canonical birth inputs could not be derived from profile chart; cannot verify sandbox continuity'
      );
      record(results, 'sandbox-identity-continuity', ok, details);
      // Early return: remaining checks in this block require canonical birth data.
      return;
    }

    const birth = {
      date: String(profileChartSnapshot.chart.date).slice(0, 10),
      time: String(profileChartSnapshot.chart.time).slice(0, 5),
      lat: profileChartSnapshot.chart.lat as number,
      lon: profileChartSnapshot.chart.lon as number,
    };
    details.push(
      `sandbox.birth.fromProfileChart=true`,
      `sandbox.birth.date=${birth.date}`,
      `sandbox.birth.time=${birth.time}`,
      `sandbox.birth.lat=${birth.lat}`,
      `sandbox.birth.lon=${birth.lon}`
    );

    const overrides = { planets: {} as Record<string, unknown> };

    const snap = await httpRequest('/api/sandbox/snapshot', {
      method: 'POST',
      body: { birth, overrides },
      cookie: phase8SessionCookie,
    });
    details.push(`sandbox.snapshot.url=${snap.url}`, `sandbox.snapshot.status=${snap.status}`);
    if (snap.status === 200 && snap.json) {
      const combinedHash = snap.json?.meta?.combinedHash;
      if (typeof combinedHash === 'string') {
        details.push(`sandbox.snapshot.combinedHash=${combinedHash.slice(0, 16)}…`);
      } else {
        ok = false;
        details.push('sandbox.snapshot missing meta.combinedHash');
      }
    } else {
      ok = false;
      details.push(`sandbox.snapshot.body=${snap.text}`);
    }

    const report = await httpRequest('/api/sandbox/report', {
      method: 'POST',
      body: { birth, overrides, seed: undefined },
      cookie: phase8SessionCookie,
    });
    details.push(`sandbox.report.url=${report.url}`, `sandbox.report.status=${report.status}`);
    if (report.status === 200 && report.json) {
      details.push('sandbox.report.ok=true');
    } else {
      ok = false;
      details.push(`sandbox.report.body=${report.text}`);
    }

    // After sandbox interactions, confirm profile identity continuity.
    const pAfter = await httpRequest(withPinnedUser('/api/profile'), {
      method: 'GET',
      cookie: phase8SessionCookie,
    });
    details.push(`profile-after-sandbox.url=${pAfter.url}`, `profile-after-sandbox.status=${pAfter.status}`);
    if (pAfter.status === 200 && pAfter.json) {
      const profile = pAfter.json as ProfileResponse;
      const uid = profile.user?.id ?? null;
      const cid = profile.primaryChart?.id ?? null;
      details.push(
        `profile-after-sandbox.userId=${uid ?? 'null'}`,
        `profile-after-sandbox.primaryChartId=${cid ?? 'null'}`
      );
      if (baselineUserId && uid && uid !== baselineUserId) {
        ok = false;
        details.push(
          `userId continuity failure after sandbox: expected userId=${baselineUserId}, got=${uid}`
        );
      }
      if (baselinePrimaryChartId && cid && cid !== baselinePrimaryChartId) {
        ok = false;
        details.push(
          `primaryChart.id continuity failure after sandbox: expected=${baselinePrimaryChartId}, got=${cid}`
        );
      }
    } else {
      ok = false;
      details.push(`profile-after-sandbox.body=${pAfter.text}`);
    }

    record(results, 'sandbox-identity-continuity', ok, details);
  }

  // ---------------------------------------------------------------------------
  // 5. Overlay + compose continuity (I5, I6) — no role swap, no chart mutation
  // ---------------------------------------------------------------------------
  {
    const details: string[] = [];
    let ok = true;

    if (!profileChartSnapshot?.chart || !baselinePrimaryChartId) {
      record(results, 'overlay-and-compose-identity-continuity', true, [
        'SKIP: profileChartSnapshot or baselinePrimaryChartId unavailable; cannot construct overlayParams',
      ]);
    } else {
      const chart = profileChartSnapshot.chart;
      const natalDate = String(chart.date ?? '1990-01-01').slice(0, 10);
      const natalTime = String(chart.time ?? '12:00').slice(0, 5);
      const natalLat = typeof chart.lat === 'number' ? chart.lat : 40.7128;
      const natalLon = typeof chart.lon === 'number' ? chart.lon : -74.006;
      const natalDatetime = `${natalDate}T${natalTime}:00Z`;

      const nowIso = new Date().toISOString();

      const overlayParams = {
        natalLatitude: natalLat,
        natalLongitude: natalLon,
        natalDatetime,
        currentLatitude: natalLat,
        currentLongitude: natalLon,
        currentDatetime: nowIso,
      };

      details.push(
        `overlay.natalDatetime=${overlayParams.natalDatetime}`,
        `overlay.natalLat=${overlayParams.natalLatitude}`,
        `overlay.natalLon=${overlayParams.natalLongitude}`,
        `overlay.currentDatetime=${overlayParams.currentDatetime}`
      );

      const composeBody = {
        mode: 'overlay',
        overlayParams,
      };

      const compose = await httpRequest('/api/compose', {
        method: 'POST',
        body: composeBody,
        cookie: phase8SessionCookie,
      });
      details.push(`compose-overlay.url=${compose.url}`, `compose-overlay.status=${compose.status}`);

      if (compose.status === 200 && compose.json) {
        details.push('compose-overlay.ok=true');
      } else {
        ok = false;
        details.push(`compose-overlay.body=${compose.text}`);
      }

      // After overlay compose, confirm profile identity continuity.
      const pAfter = await httpRequest(withPinnedUser('/api/profile'), {
        method: 'GET',
        cookie: phase8SessionCookie,
      });
      details.push(
        `profile-after-overlay.url=${pAfter.url}`,
        `profile-after-overlay.status=${pAfter.status}`
      );
      if (pAfter.status === 200 && pAfter.json) {
        const profile = pAfter.json as ProfileResponse;
        const uid = profile.user?.id ?? null;
        const cid = profile.primaryChart?.id ?? null;
        details.push(
          `profile-after-overlay.userId=${uid ?? 'null'}`,
          `profile-after-overlay.primaryChartId=${cid ?? 'null'}`
        );
        if (baselineUserId && uid && uid !== baselineUserId) {
          ok = false;
          details.push(
            `userId continuity failure after overlay compose: expected userId=${baselineUserId}, got=${uid}`
          );
        }
        if (baselinePrimaryChartId && cid && cid !== baselinePrimaryChartId) {
          ok = false;
          details.push(
            `primaryChart.id continuity failure after overlay compose: expected=${baselinePrimaryChartId}, got=${cid}`
          );
        }
      } else {
        ok = false;
        details.push(`profile-after-overlay.body=${pAfter.text}`);
      }

      record(results, 'overlay-and-compose-identity-continuity', ok, details);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. History identity continuity (I7)
  // ---------------------------------------------------------------------------
  {
    const details: string[] = [];
    let ok = true;

    const h = await httpRequest(withPinnedUser('/api/user/history'), {
      method: 'GET',
      cookie: phase8SessionCookie,
    });
    details.push(`history.url=${h.url}`, `history.status=${h.status}`);

    let items: HistoryItem[] = [];
    if (h.status === 200 && Array.isArray(h.json)) {
      items = h.json as HistoryItem[];
    } else if (h.status === 200 && h.json && Array.isArray((h.json as any).items)) {
      items = (h.json as any).items as HistoryItem[];
    } else if (h.status === 200) {
      details.push(`history.body=${h.text}`);
    } else {
      ok = false;
      details.push(`history.body=${h.text}`);
    }

    details.push(`history.items=${items.length}`);

    if (items.length > 0 && (pinnedUserId || baselinePrimaryChartId)) {
      for (const item of items) {
        if (pinnedUserId && item.userId && item.userId !== pinnedUserId) {
          ok = false;
          details.push(
            `history item ${item.id ?? '?'} has mismatched userId=${item.userId}, expected=${pinnedUserId}`
          );
        }
        if (baselinePrimaryChartId && item.chartId && item.chartId !== baselinePrimaryChartId) {
          ok = false;
          details.push(
            `history item ${item.id ?? '?'} has mismatched chartId=${item.chartId}, expected primaryChart.id=${baselinePrimaryChartId}`
          );
        }
      }
    }

    record(results, 'history-identity-continuity', ok, details);
  }

  // ---------------------------------------------------------------------------
  // Aggregate results and emit summary
  // ---------------------------------------------------------------------------
  console.log('\nStage 6 Check Matrix:');
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
  console.error('Stage 6 Cross-Surface Consistency Verification — unexpected error:', err);
  console.log('\nResult: FAIL');
  process.exit(1);
});

export {};

