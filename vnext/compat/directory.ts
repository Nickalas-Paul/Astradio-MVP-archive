/**
 * Community directory search (V1). Seeded users from match candidates; deterministic, no DB.
 */

import * as storage from './storage';

export interface DirectoryUser {
  userId: string;
  displayName: string;
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

/** Chart IDs that are allowed for public profile/snapshot-explainer (directory + default profile). */
let allowedChartIds: Set<string> | null = null;

function getAllowedChartIds(): Set<string> {
  if (allowedChartIds) return allowedChartIds;
  const ids = new Set<string>([storage.DEFAULT_PROFILE_CHART_ID]);
  const candidates = storage.ensureMatchCandidateCharts();
  for (const c of candidates) ids.add(c.chartId);
  allowedChartIds = ids;
  return ids;
}

/** V1: only directory charts (and default profile chart) can be fetched for public profile. */
export function isDirectoryChartId(chartId: string): boolean {
  return getAllowedChartIds().has(chartId);
}

/** Build full directory list (deterministic order: by displayName then userId). */
function getDirectoryUsers(): DirectoryUser[] {
  const candidates = storage.ensureMatchCandidateCharts();
  const users: DirectoryUser[] = candidates.map((c) => {
    const chart = storage.getChart(c.chartId);
    return {
      userId: c.userId,
      displayName: c.displayName,
      chartId: c.chartId,
      label: chart?.label,
    };
  });
  users.sort((a, b) => {
    const d = a.displayName.localeCompare(b.displayName);
    if (d !== 0) return d;
    return a.userId.localeCompare(b.userId);
  });
  return users;
}

/** Rank for stable sort: 0 = prefix match on displayName, 1 = prefix on userId, 2 = substring displayName, 3 = substring userId, 4 = no match. */
function matchRank(user: DirectoryUser, q: string): number {
  if (!q || !q.trim()) return 4;
  const ql = q.toLowerCase().trim();
  const dn = (user.displayName || '').toLowerCase();
  const uid = (user.userId || '').toLowerCase();
  if (dn.startsWith(ql)) return 0;
  if (uid.startsWith(ql)) return 1;
  if (dn.includes(ql)) return 2;
  if (uid.includes(ql)) return 3;
  return 4;
}

/**
 * Search directory users. Empty q = browse first N. Cursor = offset string (e.g. "0", "10"); nextCursor null if no more.
 */
export function searchDirectoryUsers(params: {
  q: string;
  limit: number;
  cursor?: string;
}): SearchDirectoryResult {
  const { q, limit: rawLimit, cursor } = params;
  const limit = Math.min(50, Math.max(1, rawLimit || 10));
  const offset = Math.max(0, parseInt(cursor || '0', 10) || 0);

  const all = getDirectoryUsers();
  const ql = (q || '').trim().toLowerCase();

  let list: DirectoryUser[];
  if (!ql) {
    list = all;
  } else {
    const matched = all.filter((u) => matchRank(u, q) < 4);
    list = matched.sort((a, b) => {
      const ra = matchRank(a, q);
      const rb = matchRank(b, q);
      if (ra !== rb) return ra - rb;
      const d = a.displayName.localeCompare(b.displayName);
      if (d !== 0) return d;
      return a.userId.localeCompare(b.userId);
    });
  }

  const slice = list.slice(offset, offset + limit);
  const nextCursor = offset + slice.length < list.length ? String(offset + limit) : null;

  return {
    q: q || '',
    limit,
    users: slice,
    nextCursor,
    generatedAt: new Date().toISOString(),
    version: DIRECTORY_VERSION,
  };
}
