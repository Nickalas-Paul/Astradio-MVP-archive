/**
 * Community Compatibility V1 — storage facade.
 * Delegates to injected adapter (pg-store or memory-store). All methods async.
 * Call setStorage(adapter) before createCompatRouter() when using Postgres.
 */

import type { User, Chart, Comparison } from './types';
import type { MatchCandidate } from './storage-adapter-types';
export type { MatchCandidate } from './storage-adapter-types';
import * as memoryStore from './memory-store';

export const DEFAULT_PROFILE_CHART_ID = 'chart_profile_default';

/** Directory-eligible user for search (Phase 8G). */
export interface DirectoryEligibleUser {
  userId: string;
  displayName: string;
  handle?: string;
  chartId: string;
  label?: string;
  /** Phase 7A discovery profile (when Postgres migration applied). */
  bio?: string;
  avatarUrl?: string;
  discoverableAs?: string;
  lookingFor?: string;
}

export type StorageAdapter = {
  createUser: (input: { id?: string; displayName: string; email?: string; handle?: string }) => Promise<User & { handle?: string }>;
  getUser: (id: string) => Promise<(User & { handle?: string }) | undefined>;
  getUserByHandle?: (handle: string) => Promise<(User & { handle?: string }) | undefined>;
  setUserPrimaryChart?: (userId: string, chartId: string) => Promise<void>;
  getUserPrimaryChart?: (userId: string) => Promise<string | undefined>;
  /** Reverse lookup for seeker chart → user (Discovery excludes self). */
  getUserIdForPrimaryChart?: (chartId: string) => Promise<string | undefined>;
  createChart: (input: any) => Promise<Chart>;
  /** Birth-field update for profile chart correction (owner-scoped). */
  updateChartBirthFields?: (
    chartId: string,
    ownerId: string,
    input: { label: string; date: string; time: string; lat: number; lon: number; timezone?: string; tz?: string }
  ) => Promise<Chart | undefined>;
  /** Persist Profile identity audio export id on chart row (optional; pg + memory adapters). */
  setChartIdentityExportId?: (chartId: string, exportId: string | null) => Promise<void>;
  getChart: (id: string) => Promise<Chart | undefined>;
  listChartsByOwner: (ownerId: string) => Promise<Chart[]>;
  createComparison: (input: Omit<Comparison, 'id' | 'createdAt'>) => Promise<Comparison>;
  getComparison: (id: string) => Promise<Comparison | undefined>;
  /** Optional: list comparisons owned by a given user (scoped by createdBy or equivalent). */
  listComparisonsByUser?: (userId: string) => Promise<Comparison[]>;
  ensureDefaultProfileChart: () => Promise<Chart>;
  ensureMatchCandidateCharts: () => Promise<MatchCandidate[]>;
  /** Phase 8G: list users eligible for directory search (discoverable + have primary chart). Optional; when absent, directory uses match candidates only. */
  listDirectoryEligibleUsers?: () => Promise<DirectoryEligibleUser[]>;
  /** Phase 8G: update discoverability / show_in_feed. Optional. */
  updateUserDiscoverability?: (userId: string, opts: { discoverable?: boolean; show_in_feed?: boolean }) => Promise<void>;
};

// Default to in-memory adapter in all runtimes (including Next).
// Render engine overrides this via setStorage(pgStore) at boot.
let adapter: StorageAdapter = memoryStore as unknown as StorageAdapter;

export function setStorage(store: StorageAdapter): void {
  adapter = store;
}

export function getStorage(): StorageAdapter {
  return adapter;
}

export async function createUser(input: { id?: string; displayName: string; email?: string; handle?: string }): Promise<User & { handle?: string }> {
  return adapter.createUser(input);
}

export async function getUser(id: string): Promise<(User & { handle?: string }) | undefined> {
  return adapter.getUser(id);
}

export async function getUserByHandle(handle: string): Promise<(User & { handle?: string }) | undefined> {
  if (adapter.getUserByHandle) return adapter.getUserByHandle(handle);
  return undefined;
}

export async function createChart(input: any): Promise<Chart> {
  return adapter.createChart(input);
}

export async function updateChartBirthFields(
  chartId: string,
  ownerId: string,
  input: { label: string; date: string; time: string; lat: number; lon: number; timezone?: string; tz?: string }
): Promise<Chart | undefined> {
  if (adapter.updateChartBirthFields) {
    return adapter.updateChartBirthFields(chartId, ownerId, input);
  }
  return undefined;
}

export async function setChartIdentityExportId(chartId: string, exportId: string | null): Promise<void> {
  if (adapter.setChartIdentityExportId) {
    await adapter.setChartIdentityExportId(chartId, exportId);
  }
}

export async function getChart(id: string): Promise<Chart | undefined> {
  return adapter.getChart(id);
}

export async function listChartsByOwner(ownerId: string): Promise<Chart[]> {
  return adapter.listChartsByOwner(ownerId);
}

export async function createComparison(input: Omit<Comparison, 'id' | 'createdAt'>): Promise<Comparison> {
  return adapter.createComparison(input);
}

export async function getComparison(id: string): Promise<Comparison | undefined> {
  return adapter.getComparison(id);
}

export async function listComparisonsByUser(userId: string): Promise<Comparison[]> {
  if (adapter.listComparisonsByUser) {
    return adapter.listComparisonsByUser(userId);
  }
  // When the underlying adapter does not support listing, return an empty list
  // rather than leaking unscoped data.
  return [];
}

export async function ensureDefaultProfileChart(): Promise<Chart> {
  return adapter.ensureDefaultProfileChart();
}

export async function ensureMatchCandidateCharts(): Promise<MatchCandidate[]> {
  return adapter.ensureMatchCandidateCharts();
}

export async function setUserPrimaryChart(userId: string, chartId: string): Promise<void> {
  if (adapter.setUserPrimaryChart) return adapter.setUserPrimaryChart(userId, chartId);
}

export async function getUserPrimaryChart(userId: string): Promise<string | undefined> {
  if (adapter.getUserPrimaryChart) return adapter.getUserPrimaryChart(userId);
  return undefined;
}

export async function getUserIdForPrimaryChart(chartId: string): Promise<string | undefined> {
  if (adapter.getUserIdForPrimaryChart) return adapter.getUserIdForPrimaryChart(chartId);
  return undefined;
}

export async function listDirectoryEligibleUsers(): Promise<DirectoryEligibleUser[]> {
  const debug = process.env.COMMUNITY_SEARCH_DEBUG === '1';
  const adapterAny = adapter as any;
  const adapterName: string = adapterAny?.__compatName || 'unknown';
  const hasCustom = typeof adapter.listDirectoryEligibleUsers === 'function';
  const started = Date.now();

  let eligible: DirectoryEligibleUser[];
  if (hasCustom) {
    eligible = await adapter.listDirectoryEligibleUsers!();
  } else {
    const candidates = await adapter.ensureMatchCandidateCharts();
    const users: DirectoryEligibleUser[] = [];
    for (const c of candidates) {
      const chart = await adapter.getChart(c.chartId);
      users.push({
        userId: c.userId,
        displayName: c.displayName,
        chartId: c.chartId,
        label: chart?.label,
        ...(c.bio ? { bio: c.bio } : {}),
        ...(c.avatarUrl ? { avatarUrl: c.avatarUrl } : {}),
        ...(c.discoverableAs != null ? { discoverableAs: c.discoverableAs } : {}),
        ...(c.lookingFor ? { lookingFor: c.lookingFor } : {}),
      });
    }
    eligible = users;
  }

  if (debug) {
    // Log adapter + high-level eligibility stats; sample first few entries only.
    const sample = eligible.slice(0, 5).map((u) => ({
      userId: u.userId,
      displayName: u.displayName,
      handle: u.handle,
      chartId: u.chartId,
      label: u.label,
    }));
    // eslint-disable-next-line no-console
    console.log('[compat][directory][eligible]', {
      adapter: adapterName,
      hasCustom,
      count: eligible.length,
      sample,
      durationMs: Date.now() - started,
    });
  }

  return eligible;
}

export async function updateUserDiscoverability(userId: string, opts: { discoverable?: boolean; show_in_feed?: boolean }): Promise<void> {
  if (adapter.updateUserDiscoverability) return adapter.updateUserDiscoverability(userId, opts);
}
