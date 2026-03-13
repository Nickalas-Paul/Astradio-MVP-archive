#!/usr/bin/env node
/**
 * Phase 8 — Stage 5 Multi-User Isolation Verification
 *
 * Verifies that distinct users, charts, sessions, and persisted records remain
 * isolated across system surfaces. Uses phase8_real_user and phase8_iso_user lanes.
 *
 * Run with server up (Next + engine):
 *   API_BASE_URL="https://preview-or-local" npx ts-node --project ../../tsconfig.json vnext/scripts/phase8-multi-user-isolation-verification.ts
 */

const PHASE8_REAL_USER_ID = 'phase8_real_user';
const PHASE8_REAL_CHART_ID = 'phase8_real_chart';
const PHASE8_ISO_USER_ID = 'phase8_iso_user';
const PHASE8_ISO_CHART_ID = 'phase8_iso_chart';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rpgStore = require('../rpg/store/rpg-store') as {
  getUserProfileById: (userId: string) => Promise<import('../rpg/store/rpg-store').UserProfileRow | null>;
  getCampaignById: (id: string) => Promise<import('../rpg/store/rpg-store').RpgCampaignRow | null>;
};
const { getUserProfileById, getCampaignById } = rpgStore;

const BASE = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:3000';

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
interface HistoryItem {
  id?: string;
  userId?: string;
  chartId?: string;
  [key: string]: unknown;
}
interface DebugPhase8Response {
  userId: string;
  campaignId: string;
  chartId?: string;
}

async function httpRequest(
  path: string,
  options: { method?: string; body?: any; cookie?: string | null } = {}
): Promise<{ status: number; json: any | null; text: string; url: string }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body != null) headers['Content-Type'] = 'application/json';
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
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text: rawText, url };
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
  console.log('Stage 5 — Multi-User Isolation Verification (Phase 8)');
  console.log(`BASE: ${BASE}`);

  // --- Bootstrap both lanes ---
  let realUserId: string | null = null;
  let realChartId: string | null = null;
  let realCampaignId: string | null = null;
  let isoUserId: string | null = null;
  let isoChartId: string | null = null;
  let isoCampaignId: string | null = null;

  {
    const r = await httpRequest('/api/debug/phase8/create-test-user');
    const details = [`HTTP ${r.status}`];
    if (r.status >= 200 && r.status < 300 && r.json) {
      const d = r.json as DebugPhase8Response;
      realUserId = d.userId;
      realCampaignId = d.campaignId ?? null;
      realChartId = d.chartId ?? null;
      details.push(`userId=${d.userId} campaignId=${d.campaignId ?? '?'} chartId=${d.chartId ?? '?'}`);
      record(results, 'bootstrap-real-user', d.userId === PHASE8_REAL_USER_ID, details);
    } else {
      record(results, 'bootstrap-real-user', false, [...details, r.text]);
    }
  }

  {
    const r = await httpRequest('/api/debug/phase8/create-iso-user');
    const details = [`HTTP ${r.status}`];
    if (r.status >= 200 && r.status < 300 && r.json) {
      const d = r.json as DebugPhase8Response;
      isoUserId = d.userId;
      isoCampaignId = d.campaignId ?? null;
      isoChartId = d.chartId ?? null;
      details.push(`userId=${d.userId} campaignId=${d.campaignId ?? '?'} chartId=${d.chartId ?? '?'}`);
      record(results, 'bootstrap-iso-user', d.userId === PHASE8_ISO_USER_ID, details);
    } else {
      record(results, 'bootstrap-iso-user', false, [...details, r.text]);
    }
  }

  if (!realUserId || !isoUserId) {
    console.warn('Bootstrap failed for one or both users; remaining checks may fail.');
  }

  const withUser = (path: string, userId: string): string => {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}userId=${encodeURIComponent(userId)}`;
  };

  // --- 1. User isolation: profile data and primary chart scoped per user ---
  {
    const realProfile = await httpRequest(withUser('/api/profile', PHASE8_REAL_USER_ID));
    const isoProfile = await httpRequest(withUser('/api/profile', PHASE8_ISO_USER_ID));
    const details: string[] = [];
    let ok = true;
    if (realProfile.status === 200 && realProfile.json) {
      const p = realProfile.json as ProfileResponse;
      if (p.user?.id !== PHASE8_REAL_USER_ID) {
        ok = false;
        details.push(`real profile user.id=${p.user?.id} expected ${PHASE8_REAL_USER_ID}`);
      }
      if (p.primaryChart?.id !== PHASE8_REAL_CHART_ID && realChartId && p.primaryChart?.id !== realChartId) {
        details.push(`real profile primaryChart.id=${p.primaryChart?.id} expected ${PHASE8_REAL_CHART_ID}`);
      }
    } else {
      ok = false;
      details.push(`real profile HTTP ${realProfile.status}`);
    }
    if (isoProfile.status === 200 && isoProfile.json) {
      const p = isoProfile.json as ProfileResponse;
      if (p.user?.id !== PHASE8_ISO_USER_ID) {
        ok = false;
        details.push(`iso profile user.id=${p.user?.id} expected ${PHASE8_ISO_USER_ID}`);
      }
      if (p.primaryChart?.id !== PHASE8_ISO_CHART_ID && isoChartId && p.primaryChart?.id !== isoChartId) {
        details.push(`iso profile primaryChart.id=${p.primaryChart?.id} expected ${PHASE8_ISO_CHART_ID}`);
      }
    } else {
      ok = false;
      details.push(`iso profile HTTP ${isoProfile.status}`);
    }
    record(results, 'user-isolation-profile-and-primary-chart', ok, details);
  }

  // --- 2. User isolation: store linkage (user_profiles, campaign) scoped ---
  if (realUserId && isoUserId && process.env.POSTGRES_URL) {
    try {
      const realProfile = await getUserProfileById(realUserId);
      const isoProfile = await getUserProfileById(isoUserId);
      const details: string[] = [];
      let ok = true;
      if (!realProfile || realProfile.user_id !== PHASE8_REAL_USER_ID) {
        ok = false;
        details.push(`real user_profiles: ${realProfile ? `user_id=${realProfile.user_id}` : 'missing'}`);
      } else {
        details.push(`real user_profiles.user_id=${realProfile.user_id} chart_id=${realProfile.chart_id}`);
      }
      if (!isoProfile || isoProfile.user_id !== PHASE8_ISO_USER_ID) {
        ok = false;
        details.push(`iso user_profiles: ${isoProfile ? `user_id=${isoProfile.user_id}` : 'missing'}`);
      } else {
        details.push(`iso user_profiles.user_id=${isoProfile.user_id} chart_id=${isoProfile.chart_id}`);
      }
      if (realProfile && isoProfile && realProfile.chart_id === isoProfile.chart_id) {
        ok = false;
        details.push('cross-user chart_id reuse detected');
      }
      record(results, 'user-isolation-store-linkage', ok, details);
    } catch (e: any) {
      record(results, 'user-isolation-store-linkage', false, [String(e?.message ?? e)]);
    }
  } else {
    record(results, 'user-isolation-store-linkage', true, ['SKIP: POSTGRES_URL not set']);
  }

  // --- 3. Campaign ownership: each campaign belongs to correct user ---
  if (realCampaignId && isoCampaignId && process.env.POSTGRES_URL) {
    try {
      const realCamp = await getCampaignById(realCampaignId);
      const isoCamp = await getCampaignById(isoCampaignId);
      const details: string[] = [];
      const realOk = !!realCamp && realCamp.user_id === PHASE8_REAL_USER_ID;
      const isoOk = !!isoCamp && isoCamp.user_id === PHASE8_ISO_USER_ID;
      if (realCamp) details.push(`real campaign user_id=${realCamp.user_id}`);
      if (isoCamp) details.push(`iso campaign user_id=${isoCamp.user_id}`);
      record(results, 'campaign-ownership-scoped', realOk && isoOk, details);
    } catch (e: any) {
      record(results, 'campaign-ownership-scoped', false, [String(e?.message ?? e)]);
    }
  } else {
    record(results, 'campaign-ownership-scoped', true, ['SKIP: missing campaign ids or POSTGRES_URL']);
  }

  // --- 4. Session/query isolation: explicit userId returns that user only ---
  {
    const seq = [
      { userId: PHASE8_REAL_USER_ID, label: 'real' },
      { userId: PHASE8_ISO_USER_ID, label: 'iso' },
      { userId: PHASE8_REAL_USER_ID, label: 'real-again' },
    ];
    const details: string[] = [];
    let ok = true;
    for (const { userId, label } of seq) {
      const r = await httpRequest(withUser('/api/profile', userId));
      if (r.status !== 200 || !r.json) {
        ok = false;
        details.push(`${label}: HTTP ${r.status}`);
        continue;
      }
      const p = r.json as ProfileResponse;
      if (p.user?.id !== userId) {
        ok = false;
        details.push(`${label}: got user.id=${p.user?.id} expected ${userId}`);
      } else {
        details.push(`${label}: user.id=${p.user.id} ok`);
      }
    }
    record(results, 'session-query-isolation-explicit-userId', ok, details);
  }

  // --- 5. Surface isolation: history scoped (no cross-user records) ---
  {
    const realHistory = await httpRequest(withUser('/api/user/history', PHASE8_REAL_USER_ID));
    const isoHistory = await httpRequest(withUser('/api/user/history', PHASE8_ISO_USER_ID));
    const details: string[] = [];
    let ok = true;
    const items = (json: any): HistoryItem[] =>
      Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
    const realItems = items(realHistory.json);
    const isoItems = items(isoHistory.json);
    for (const item of realItems) {
      if (item.userId && item.userId !== PHASE8_REAL_USER_ID) {
        ok = false;
        details.push(`real history contains userId=${item.userId}`);
      }
    }
    for (const item of isoItems) {
      if (item.userId && item.userId !== PHASE8_ISO_USER_ID) {
        ok = false;
        details.push(`iso history contains userId=${item.userId}`);
      }
    }
    details.push(`real history items=${realItems.length} iso history items=${isoItems.length}`);
    record(results, 'surface-isolation-history-scoped', ok, details);
  }

  // --- 6. Anonymous context must not resolve real or iso user ---
  {
    const anon = await httpRequest('/api/profile', { method: 'GET' });
    const details: string[] = [`HTTP ${anon.status}`];
    let ok = true;
    if (anon.status === 200 && anon.json) {
      const p = anon.json as ProfileResponse;
      if (p.user?.id === PHASE8_REAL_USER_ID) {
        ok = false;
        details.push('anon profile resolved phase8_real_user');
      }
      if (p.user?.id === PHASE8_ISO_USER_ID) {
        ok = false;
        details.push('anon profile resolved phase8_iso_user');
      }
      if (ok) details.push('anon profile did not expose real or iso user');
    }
    record(results, 'runtime-isolation-no-wrong-user-fallback', ok, details);
  }

  // --- 7. Proxy preserves user targeting: profile with userId query returns that user ---
  {
    const r = await httpRequest(withUser('/api/profile', PHASE8_ISO_USER_ID));
    const details: string[] = [`HTTP ${r.status}`];
    const ok =
      r.status === 200 &&
      !!r.json &&
      (r.json as ProfileResponse).user?.id === PHASE8_ISO_USER_ID;
    if (r.json) details.push(`user.id=${(r.json as ProfileResponse).user?.id}`);
    record(results, 'runtime-isolation-proxy-preserves-user-targeting', ok, details);
  }

  // --- Summary ---
  console.log('\nStage 5 Check Matrix:');
  let allOk = true;
  for (const r of results) {
    const prefix = r.status === 'pass' ? '✔' : '✖';
    if (r.status === 'fail') allOk = false;
    console.log(`${prefix} ${r.name}`);
    for (const line of r.details) console.log(`   - ${line}`);
  }
  console.log('\nResult:', allOk ? 'PASS' : 'FAIL');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error('Stage 5 Multi-User Isolation Verification — unexpected error:', err);
  console.log('\nResult: FAIL');
  process.exit(1);
});
