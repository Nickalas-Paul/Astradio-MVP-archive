/**
 * In-memory async store — same API as pg-store, for when POSTGRES_URL is not set.
 * All methods return Promises; data is lost on restart.
 */

import type { User, Chart, Comparison } from './types';
import type { MatchCandidate } from './storage-adapter-types';

// Name used by compat storage for observability (e.g. logs).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(exports as any).__compatName = 'memory';

import { resolveChartTimezoneForChartInsert } from './chart-timezone-resolve';
import { natalBirthKeyChanged } from './natal-identity-birth-compare';

const nanoid = () =>
  require('crypto').randomBytes(8).toString('hex');
const now = () => new Date().toISOString();

const users = new Map<string, User & { handle?: string }>();
const charts = new Map<string, Chart>();
const comparisons = new Map<string, Comparison>();
const userPrimaryChart = new Map<string, string>();

export const DEFAULT_PROFILE_CHART_ID = 'chart_profile_default';

const MATCH_CANDIDATE_SPECS: Array<{ id: string; userId: string; displayName: string; label: string; date: string; time: string; lat: number; lon: number }> = [
  { id: 'chart_match_1', userId: 'usr_demo_1', displayName: 'Demo User 1', label: 'Natal 1', date: '1985-06-10', time: '14:30', lat: 51.5074, lon: -0.1278 },
  { id: 'chart_match_2', userId: 'usr_demo_2', displayName: 'Demo User 2', label: 'Natal 2', date: '1992-11-22', time: '08:00', lat: 40.7128, lon: -74.006 },
  { id: 'chart_match_3', userId: 'usr_demo_3', displayName: 'Demo User 3', label: 'Natal 3', date: '1988-03-05', time: '18:45', lat: 34.0522, lon: -118.2437 },
  { id: 'chart_match_4', userId: 'usr_demo_4', displayName: 'Demo User 4', label: 'Natal 4', date: '1995-09-14', time: '12:00', lat: 41.8781, lon: -87.6298 },
  { id: 'chart_match_5', userId: 'usr_demo_5', displayName: 'Demo User 5', label: 'Natal 5', date: '1990-01-15', time: '06:00', lat: 37.7749, lon: -122.4194 },
];

// Directory user for community search (Phase 8G, in-memory variant).
export interface DirectoryEligibleUser {
  userId: string;
  displayName: string;
  handle?: string;
  chartId: string;
  label?: string;
  bio?: string;
  avatarUrl?: string;
  discoverableAs?: string;
  lookingFor?: string;
}

// Community in-memory (minimal for compat router; engine community routes use lib/pg-store)
const groups = new Map<string, any>();
const memberships = new Map<string, any>();
const posts = new Map<string, any>();
const comments = new Map<string, any>();
const reports = new Map<string, any>();

export async function createUser(input: { id?: string; displayName: string; email?: string; handle?: string }): Promise<User & { handle?: string }> {
  const id = input.id || `usr_${nanoid()}`;
  const handle = input.handle != null ? input.handle : id;
  const user: User & { handle?: string } = {
    id,
    displayName: input.displayName || 'User',
    email: input.email,
    createdAt: now(),
    updatedAt: now(),
    handle,
  };
  users.set(id, user);
  return user;
}

export async function getUser(id: string): Promise<(User & { handle?: string }) | undefined> {
  return users.get(id);
}

export async function getUserByHandle(handle: string): Promise<(User & { handle?: string }) | undefined> {
  return [...users.values()].find((u) => u.handle === handle);
}

export async function setUserPrimaryChart(userId: string, chartId: string): Promise<void> {
  userPrimaryChart.set(userId, chartId);
}

export async function getUserPrimaryChart(userId: string): Promise<string | undefined> {
  return userPrimaryChart.get(userId);
}

export async function getUserIdForPrimaryChart(chartId: string): Promise<string | undefined> {
  for (const [uid, cid] of userPrimaryChart.entries()) {
    if (cid === chartId) return uid;
  }
  return undefined;
}

export async function createChart(input: {
  id?: string;
  ownerId?: string;
  label: string;
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
  tz?: string;
  snapshotHash?: string;
  identityExportId?: string | null;
}): Promise<Chart> {
  const id = input.id || `chart_${nanoid()}`;
  const resolvedTimezone = resolveChartTimezoneForChartInsert({
    timezone: input.timezone,
    tz: input.tz,
    lat: input.lat,
    lon: input.lon,
  });
  const chart: Chart = {
    id,
    ownerId: input.ownerId,
    label: input.label,
    date: input.date,
    time: input.time,
    lat: input.lat,
    lon: input.lon,
    timezone: resolvedTimezone,
    snapshotHash: input.snapshotHash,
    identityExportId: input.identityExportId ?? null,
    createdAt: now(),
    updatedAt: now(),
  };
  charts.set(id, chart);
  return chart;
}

export async function getChart(id: string): Promise<Chart | undefined> {
  return charts.get(id);
}

export async function listChartsByOwner(ownerId: string): Promise<Chart[]> {
  return Array.from(charts.values()).filter((c) => c.ownerId === ownerId);
}

export async function updateChartBirthFields(
  chartId: string,
  ownerId: string,
  input: {
    label: string;
    date: string;
    time: string;
    lat: number;
    lon: number;
    timezone?: string;
    tz?: string;
  }
): Promise<Chart | undefined> {
  const c = charts.get(chartId);
  if (!c || c.ownerId !== ownerId) {
    const err = new Error('Chart not found or not owned by user') as Error & { code?: string };
    err.code = 'CHART_UPDATE_FORBIDDEN';
    throw err;
  }
  const resolvedTimezone = resolveChartTimezoneForChartInsert({
    timezone: input.timezone,
    tz: input.tz,
    lat: input.lat,
    lon: input.lon,
  });
  const before = { date: c.date, time: c.time, lat: c.lat, lon: c.lon, timezone: c.timezone };
  const clearIdentityExport = natalBirthKeyChanged(before, input, resolvedTimezone);
  const updated: Chart = {
    ...c,
    label: input.label,
    date: input.date,
    time: input.time,
    lat: input.lat,
    lon: input.lon,
    timezone: resolvedTimezone,
    snapshotHash: undefined,
    identityExportId: clearIdentityExport ? null : (c.identityExportId ?? null),
    updatedAt: now(),
  };
  charts.set(chartId, updated);
  return updated;
}

export async function setChartIdentityExportId(chartId: string, exportId: string | null): Promise<void> {
  const c = charts.get(chartId);
  if (!c) return;
  charts.set(chartId, { ...c, identityExportId: exportId, updatedAt: now() });
}

export async function createComparison(input: Omit<Comparison, 'id' | 'createdAt'>): Promise<Comparison> {
  const id = `cmp_${nanoid()}`;
  const comparison: Comparison = {
    ...input,
    id,
    createdAt: now(),
  };
  comparisons.set(id, comparison);
  return comparison;
}

export async function getComparison(id: string): Promise<Comparison | undefined> {
  return comparisons.get(id);
}

export async function listComparisonsByUser(userId: string): Promise<Comparison[]> {
  return Array.from(comparisons.values()).filter((c) => (c as any).createdBy === userId);
}

export async function ensureDefaultProfileChart(): Promise<Chart> {
  let chart = charts.get(DEFAULT_PROFILE_CHART_ID);
  if (chart) return chart;
  const resolvedTimezone = resolveChartTimezoneForChartInsert({ lat: 40.7128, lon: -74.006 });
  chart = {
    id: DEFAULT_PROFILE_CHART_ID,
    ownerId: undefined,
    label: 'My Natal',
    date: '1990-01-15',
    time: '12:00',
    lat: 40.7128,
    lon: -74.006,
    timezone: resolvedTimezone,
    snapshotHash: undefined,
    createdAt: now(),
    updatedAt: now(),
  };
  charts.set(DEFAULT_PROFILE_CHART_ID, chart);
  return chart;
}

export async function ensureMatchCandidateCharts(): Promise<MatchCandidate[]> {
  const out: MatchCandidate[] = [];
  for (const spec of MATCH_CANDIDATE_SPECS) {
    if (!charts.has(spec.id)) {
      await createUser({ id: spec.userId, displayName: spec.displayName });
      await createChart({
        id: spec.id,
        ownerId: spec.userId,
        label: spec.label,
        date: spec.date,
        time: spec.time,
        lat: spec.lat,
        lon: spec.lon,
      });
      await setUserPrimaryChart(spec.userId, spec.id);
    }
    out.push({ chartId: spec.id, userId: spec.userId, displayName: spec.displayName });
  }
  return out;
}

// Phase 8G: users eligible for directory search in in-memory mode.
// - Includes all real users that have a primary chart.
// - Seeded demo users are already present in `users`/`userPrimaryChart` via ensureMatchCandidateCharts.
export async function listDirectoryEligibleUsers(): Promise<DirectoryEligibleUser[]> {
  const list: DirectoryEligibleUser[] = [];
  for (const u of users.values()) {
    const chartId = userPrimaryChart.get(u.id);
    if (!chartId) continue;
    const chart = charts.get(chartId);
    list.push({
      userId: u.id,
      displayName: u.displayName || 'User',
      handle: u.handle,
      chartId,
      label: chart?.label,
      discoverableAs: u.discoverableAs ?? 'both',
      ...(u.bio ? { bio: u.bio } : {}),
      ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
      ...(u.lookingFor ? { lookingFor: u.lookingFor } : {}),
    });
  }
  list.sort((a, b) => {
    const d = a.displayName.localeCompare(b.displayName);
    if (d !== 0) return d;
    return a.userId.localeCompare(b.userId);
  });
  return list;
}

// Community (in-memory fallback)
export async function createGroup(input: { slug?: string; name: string; description?: string; tags?: string[] }): Promise<any> {
  const id = `grp_${nanoid()}`;
  const slug = input.slug || id;
  const g = { id, slug, name: input.name || 'Unnamed', description: input.description || '', tags: input.tags || [], visibility: 'public', createdAt: now() };
  groups.set(id, g);
  return g;
}
export async function getGroup(id: string): Promise<any> {
  return groups.get(id);
}
export async function getGroupBySlug(slug: string): Promise<any> {
  return [...groups.values()].find((g) => g.slug === slug);
}
export async function listGroups(opts?: { tag?: string; q?: string }): Promise<any[]> {
  let list = [...groups.values()];
  if (opts?.tag) list = list.filter((g) => g.tags && g.tags.includes(opts.tag));
  if (opts?.q && opts.q.trim()) {
    const lower = opts.q.trim().toLowerCase();
    list = list.filter(
      (g) =>
        (g.name && g.name.toLowerCase().includes(lower)) ||
        (g.description && g.description.toLowerCase().includes(lower)) ||
        (g.tags && g.tags.some((t: string) => t.toLowerCase().includes(lower)))
    );
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export async function createMembership(input: { groupId: string; userId: string; role?: string; chartId?: string }): Promise<any> {
  const id = `mem_${nanoid()}`;
  const m = { id, groupId: input.groupId, userId: input.userId, role: input.role || 'member', chartId: input.chartId || null, createdAt: now() };
  memberships.set(id, m);
  return m;
}
export async function getMembership(id: string): Promise<any> {
  return memberships.get(id);
}
export async function getMembershipsByGroup(groupId: string): Promise<any[]> {
  return [...memberships.values()].filter((m) => m.groupId === groupId).sort((a, b) => a.id.localeCompare(b.id));
}
export async function getMembershipsByUser(userId: string): Promise<any[]> {
  return [...memberships.values()].filter((m) => m.userId === userId);
}
export async function isMember(groupId: string, userId: string): Promise<boolean> {
  return [...memberships.values()].some((m) => m.groupId === groupId && m.userId === userId);
}
export async function createPost(input: { groupId: string; userId: string; title?: string; body?: string }): Promise<any> {
  const id = `post_${nanoid()}`;
  const p = { id, groupId: input.groupId, userId: input.userId, title: input.title || '', body: input.body || '', createdAt: now() };
  posts.set(id, p);
  return p;
}
export async function getPost(id: string): Promise<any> {
  return posts.get(id);
}
export async function listPostsByGroup(groupId: string, opts?: { limit?: number }): Promise<any[]> {
  return [...posts.values()]
    .filter((p) => p.groupId === groupId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, opts?.limit ?? 50);
}
export async function createComment(input: { postId: string; userId: string; body?: string }): Promise<any> {
  const id = `com_${nanoid()}`;
  const c = { id, postId: input.postId, userId: input.userId, body: input.body || '', createdAt: now() };
  comments.set(id, c);
  return c;
}
export async function getComment(id: string): Promise<any> {
  return comments.get(id);
}
export async function listCommentsByPost(postId: string): Promise<any[]> {
  return [...comments.values()].filter((c) => c.postId === postId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
export async function createReport(input: { targetType: string; targetId: string; reason: string; note?: string }): Promise<any> {
  const id = `rpt_${nanoid()}`;
  const r = { id, ...input, createdAt: now() };
  reports.set(id, r);
  return r;
}
export async function listReports(): Promise<any[]> {
  return [...reports.values()];
}
export async function ensureDevUser(): Promise<any> {
  let u = await getUserByHandle('@dev');
  if (!u) u = await createUser({ handle: '@dev', displayName: 'Dev User' });
  return u;
}
export async function createExportJob(_input: any): Promise<any> {
  return Promise.resolve(null);
}
export async function getExportJob(_id: string): Promise<any> {
  return undefined;
}
