/**
 * Server-side scope resolver for compatibility intent.
 * Relational groups only (astradio_relational_groups + astradio_relational_group_members).
 * Legacy community-store is not used.
 */

import { getChartById } from '../compat/chart-store';
import * as compatStorage from '../compat/storage';

export type ScopeType = 'my_groups' | 'group' | 'global';

export interface ScopedCandidate {
  chartId: string;
  userId: string;
  displayName?: string;
}

type PgRelational = {
  getUser: (id: string) => Promise<{ displayName?: string; handle?: string } | undefined>;
  listRelationalGroupMembersForScope: (
    groupId: string,
    viewerUserId: string
  ) => Promise<
    | Array<{
        chartId: string;
        userId: string | null;
        label?: string | null;
      }>
    | undefined
  >;
  resolveRelationalGroupForScope: (
    slugOrId: string,
    viewerUserId: string
  ) => Promise<{ id: string } | undefined>;
  listRelationalGroupsAccessibleToUser: (
    userId: string
  ) => Promise<Array<{ id: string }>>;
};

function loadPgRelational(): PgRelational | null {
  if (!process.env.POSTGRES_URL) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require('../../../../lib/pg-store') as PgRelational;
    return m;
  } catch {
    return null;
  }
}

function syntheticUserIdForMember(m: { userId: string | null; chartId: string }): string {
  if (m.userId) return m.userId;
  return `non_platform:${m.chartId}`;
}

/**
 * Get scoped candidates. Returns stable-ordered list (by chartId).
 * Only includes charts that exist in compat storage.
 */
export async function getScopedCandidates(
  scope: ScopeType = 'global',
  groupId?: string,
  seekerUserId?: string
): Promise<ScopedCandidate[]> {
  const byChartId = (a: ScopedCandidate, b: ScopedCandidate) => a.chartId.localeCompare(b.chartId);
  const pg = loadPgRelational();

  if (scope === 'global') {
    const candidates = await compatStorage.ensureMatchCandidateCharts();
    const out: ScopedCandidate[] = [];
    for (const c of candidates) {
      const chart = await getChartById(c.chartId);
      if (chart) out.push({ chartId: c.chartId, userId: c.userId, displayName: c.displayName });
    }
    return out.sort(byChartId);
  }

  if (scope === 'group' && groupId) {
    if (!seekerUserId || !pg) return [];
    const group = await pg.resolveRelationalGroupForScope(groupId, seekerUserId);
    if (!group) return [];
    const memberships = await pg.listRelationalGroupMembersForScope(group.id, seekerUserId);
    if (!memberships) return [];
    const out: ScopedCandidate[] = [];
    for (const m of memberships) {
      if (!m.chartId) continue;
      const chart = await getChartById(m.chartId);
      if (!chart) continue;
      const uid = syntheticUserIdForMember(m);
      let displayName: string | undefined;
      if (m.userId) {
        const u = await pg.getUser(m.userId);
        displayName = u?.displayName || u?.handle || m.userId;
      } else {
        displayName = (m.label && String(m.label)) || m.chartId;
      }
      out.push({ chartId: m.chartId, userId: uid, displayName });
    }
    return out.sort(byChartId);
  }

  if (scope === 'my_groups' && seekerUserId && pg) {
    const groups = await pg.listRelationalGroupsAccessibleToUser(seekerUserId);
    const seen = new Set<string>();
    const out: ScopedCandidate[] = [];
    for (const g of groups) {
      const memberships = await pg.listRelationalGroupMembersForScope(g.id, seekerUserId);
      if (!memberships) continue;
      for (const m of memberships) {
        if (!m.chartId || seen.has(m.chartId)) continue;
        const chart = await getChartById(m.chartId);
        if (!chart) continue;
        seen.add(m.chartId);
        const uid = syntheticUserIdForMember(m);
        let displayName: string | undefined;
        if (m.userId) {
          const u = await pg.getUser(m.userId);
          displayName = u?.displayName || u?.handle || m.userId;
        } else {
          displayName = (m.label && String(m.label)) || m.chartId;
        }
        out.push({ chartId: m.chartId, userId: uid, displayName });
      }
    }
    return out.sort(byChartId);
  }

  return [];
}
