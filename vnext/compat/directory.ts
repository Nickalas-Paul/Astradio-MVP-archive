/**
 * Community directory search (V1). Phase 8G: match candidates + real discoverable users with primary chart.
 * All methods async (storage is async).
 */

import * as storage from './storage';

export interface DirectoryUser {
  userId: string;
  displayName: string;
  handle?: string;
  chartId: string;
  label?: string;
  locationLabel?: string;
}

export interface SearchDirectoryResult {
  q: string;
  limit: number;
  users: DirectoryUser[];
  nextCursor: string | null;
  generatedAt: string;
  version: string;
}

const DIRECTORY_VERSION = 'v1';

let allowedChartIdsCache: Set<string> | null = null;

async function getAllowedChartIds(): Promise<Set<string>> {
  if (allowedChartIdsCache) return allowedChartIdsCache;
  await storage.ensureDefaultProfileChart();
  const candidates = await storage.ensureMatchCandidateCharts();
  const ids = new Set<string>([storage.DEFAULT_PROFILE_CHART_ID]);
  for (const c of candidates) ids.add(c.chartId);
  allowedChartIdsCache = ids;
  return ids;
}

export async function isDirectoryChartId(chartId: string): Promise<boolean> {
  const ids = await getAllowedChartIds();
  return ids.has(chartId);
}

async function getDirectoryUsers(): Promise<DirectoryUser[]> {
  const eligible = await storage.listDirectoryEligibleUsers();
  const users: DirectoryUser[] = eligible.map((e) => ({
    userId: e.userId,
    displayName: e.displayName,
    handle: e.handle,
    chartId: e.chartId,
    label: e.label,
  }));
  users.sort((a, b) => {
    const d = a.displayName.localeCompare(b.displayName);
    if (d !== 0) return d;
    return a.userId.localeCompare(b.userId);
  });
  return users;
}

function matchRank(user: DirectoryUser, q: string): number {
  if (!q || !q.trim()) return 4;
  const ql = q.toLowerCase().trim();
  const dn = (user.displayName || '').toLowerCase();
  const uid = (user.userId || '').toLowerCase();
  const handle = (user.handle || '').toLowerCase();
  if (dn.startsWith(ql)) return 0;
  if (uid.startsWith(ql)) return 1;
  if (handle.startsWith(ql)) return 1;
  if (dn.includes(ql)) return 2;
  if (uid.includes(ql)) return 3;
  if (handle.includes(ql)) return 3;
  return 4;
}

export async function searchDirectoryUsers(params: {
  q: string;
  limit: number;
  cursor?: string;
}): Promise<SearchDirectoryResult> {
  const debug = process.env.COMMUNITY_SEARCH_DEBUG === '1';
  const started = Date.now();
  const { q, limit: rawLimit, cursor } = params;
  const limit = Math.min(50, Math.max(1, rawLimit || 10));
  const offset = Math.max(0, parseInt(cursor || '0', 10) || 0);

  const ql = (q || '').trim().toLowerCase();

  // Privacy: do not return all users when query is empty. Discovery is not an open directory.
  let list: DirectoryUser[];
  if (!ql || ql.length < 2) {
    list = [];
  } else {
    const all = await getDirectoryUsers();
    const matched = all.filter((u) => matchRank(u, ql) < 4);
    list = matched.sort((a, b) => {
      const ra = matchRank(a, ql);
      const rb = matchRank(b, ql);
      if (ra !== rb) return ra - rb;
      const d = a.displayName.localeCompare(b.displayName);
      if (d !== 0) return d;
      return a.userId.localeCompare(b.userId);
    });
  }

  const slice = list.slice(offset, offset + limit);
  const nextCursor = offset + slice.length < list.length ? String(offset + limit) : null;

  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[compat][directory][search]', {
      q: q || '',
      limit,
      totalCandidates: list.length,
      returned: slice.length,
      offset,
      durationMs: Date.now() - started,
      sample: slice.slice(0, 5).map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        handle: u.handle,
        chartId: u.chartId,
        label: u.label,
      })),
    });
  }

  return {
    q: q || '',
    limit,
    users: slice,
    nextCursor,
    generatedAt: new Date().toISOString(),
    version: DIRECTORY_VERSION,
  };
}
