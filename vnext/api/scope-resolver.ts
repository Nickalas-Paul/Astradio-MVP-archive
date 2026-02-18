/**
 * Phase 3C — Server-side scope resolver for compatibility intent.
 * Returns candidate chartIds (with userId, displayName) restricted by scope.
 * Candidate charts must exist in compat storage.
 */

import * as compatStorage from '../compat/storage';

export type ScopeType = 'my_groups' | 'group' | 'global';

export interface ScopedCandidate {
  chartId: string;
  userId: string;
  displayName?: string;
}

let communityStore: {
  getGroup: (id: string) => { id: string } | undefined;
  getGroupBySlug: (slug: string) => { id: string } | undefined;
  getMembershipsByGroup: (groupId: string) => Array<{ userId: string; chartId?: string }>;
  getMembershipsByUser: (userId: string) => Array<{ groupId: string }>;
  getUser: (id: string) => { displayName?: string; handle?: string } | undefined;
} | null = null;

try {
  // From dist/vnext/vnext/api/ -> project root lib
  communityStore = require('../../../../lib/community-store');
} catch {
  // community store not available (e.g. test env)
}

function resolveGroup(slugOrId: string): { id: string } | undefined {
  if (!communityStore) return undefined;
  if (slugOrId && slugOrId.startsWith('grp_')) return communityStore.getGroup(slugOrId);
  return communityStore.getGroupBySlug(slugOrId);
}

/**
 * Get scoped candidates. Returns stable-ordered list (by chartId).
 * Only includes charts that exist in compat storage.
 */
export function getScopedCandidates(
  scope: ScopeType = 'global',
  groupId?: string,
  seekerUserId?: string
): ScopedCandidate[] {
  const byChartId = (a: ScopedCandidate, b: ScopedCandidate) => a.chartId.localeCompare(b.chartId);

  if (scope === 'global') {
    const candidates = compatStorage.ensureMatchCandidateCharts();
    const out: ScopedCandidate[] = [];
    for (const c of candidates) {
      if (compatStorage.getChart(c.chartId)) {
        out.push({ chartId: c.chartId, userId: c.userId, displayName: c.displayName });
      }
    }
    return out.sort(byChartId);
  }

  if (scope === 'group' && groupId) {
    const group = resolveGroup(groupId) || communityStore?.getGroup(groupId);
    if (!group || !communityStore) return [];
    const memberships = communityStore.getMembershipsByGroup(group.id);
    const out: ScopedCandidate[] = [];
    for (const m of memberships) {
      if (!m.chartId) continue;
      if (!compatStorage.getChart(m.chartId)) continue;
      const u = communityStore.getUser(m.userId);
      out.push({
        chartId: m.chartId,
        userId: m.userId,
        displayName: u?.displayName || u?.handle || m.userId
      });
    }
    return out.sort(byChartId);
  }

  if (scope === 'my_groups' && seekerUserId && communityStore) {
    const myMemberships = communityStore.getMembershipsByUser(seekerUserId);
    const groupIds = [...new Set(myMemberships.map((m) => m.groupId))];
    const seen = new Set<string>();
    const out: ScopedCandidate[] = [];
    for (const gid of groupIds) {
      const memberships = communityStore.getMembershipsByGroup(gid);
      for (const m of memberships) {
        if (!m.chartId || seen.has(m.chartId)) continue;
        if (!compatStorage.getChart(m.chartId)) continue;
        seen.add(m.chartId);
        const u = communityStore.getUser(m.userId);
        out.push({
          chartId: m.chartId,
          userId: m.userId,
          displayName: u?.displayName || u?.handle || m.userId
        });
      }
    }
    return out.sort(byChartId);
  }

  return [];
}
