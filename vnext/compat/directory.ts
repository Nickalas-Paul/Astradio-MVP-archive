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

function normalizeText(s: string): string {
  if (!s) return '';
  try {
    // Normalize accents, strip diacritics, collapse whitespace/punctuation.
    return s
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9@]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return String(s).toLowerCase().trim();
  }
}

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

function matchRank(user: DirectoryUser, qNormalized: string, rawQuery?: string): number {
  const qNorm = (qNormalized || '').trim();
  if (qNorm.length >= 2) {
    const dnNorm = normalizeText(user.displayName || '');
    const uidNorm = normalizeText(user.userId || '');
    const handleNorm = normalizeText(user.handle || '');

    if (dnNorm.startsWith(qNorm)) return 0;
    if (uidNorm.startsWith(qNorm)) return 1;
    if (handleNorm.startsWith(qNorm)) return 1;
    if (dnNorm.includes(qNorm)) return 2;
    if (uidNorm.includes(qNorm)) return 3;
    if (handleNorm.includes(qNorm)) return 3;
  }

  const rq = (rawQuery && rawQuery.length >= 2) ? rawQuery.trim().toLowerCase() : '';
  if (rq) {
    const dn = (user.displayName || '').toLowerCase();
    const uid = (user.userId || '').toLowerCase();
    const handle = (user.handle || '').toLowerCase();
    if (dn.includes(rq)) return 2;
    if (uid.includes(rq)) return 3;
    if (handle.includes(rq)) return 3;
  }
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

  const qNorm = normalizeText(q || '');
  const rawQ = (q || '').trim().length >= 2 ? (q || '').trim() : '';

  // Privacy: do not return all users when query is empty. Discovery is not an open directory.
  let list: DirectoryUser[];
  if ((!qNorm || qNorm.length < 2) && !rawQ) {
    list = [];
  } else {
    const all = await getDirectoryUsers();
    const matched = all.filter((u) => matchRank(u, qNorm, rawQ) < 4);
    list = matched.sort((a, b) => {
      const ra = matchRank(a, qNorm, rawQ);
      const rb = matchRank(b, qNorm, rawQ);
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
      qNormalized: qNorm,
      limit,
      totalCandidates: list.length,
      returned: slice.length,
      offset,
      durationMs: Date.now() - started,
      sample: slice.slice(0, 8).map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        handle: u.handle,
        chartId: u.chartId,
        label: u.label,
        rank: matchRank(u, qNorm, rawQ),
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
