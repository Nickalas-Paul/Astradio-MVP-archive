/**
 * Community Compatibility V1 — storage facade.
 * Delegates to injected adapter (pg-store or memory-store). All methods async.
 * Call setStorage(adapter) before createCompatRouter() when using Postgres.
 */

import type { User, Chart, Comparison } from './types';
import type { MatchCandidate } from './storage-adapter-types';
export type { MatchCandidate } from './storage-adapter-types';
import * as memoryStore from './memory-store';

type PgStoreModule = typeof import('../../lib/pg-store');

export const DEFAULT_PROFILE_CHART_ID = 'chart_profile_default';

/** Directory-eligible user for search (Phase 8G). */
export interface DirectoryEligibleUser {
  userId: string;
  displayName: string;
  handle?: string;
  chartId: string;
  label?: string;
}

export type StorageAdapter = {
  createUser: (input: { id?: string; displayName: string; email?: string; handle?: string }) => Promise<User & { handle?: string }>;
  getUser: (id: string) => Promise<(User & { handle?: string }) | undefined>;
  getUserByHandle?: (handle: string) => Promise<(User & { handle?: string }) | undefined>;
  setUserPrimaryChart?: (userId: string, chartId: string) => Promise<void>;
  getUserPrimaryChart?: (userId: string) => Promise<string | undefined>;
  createChart: (input: any) => Promise<Chart>;
  getChart: (id: string) => Promise<Chart | undefined>;
  listChartsByOwner: (ownerId: string) => Promise<Chart[]>;
  createComparison: (input: Omit<Comparison, 'id' | 'createdAt'>) => Promise<Comparison>;
  getComparison: (id: string) => Promise<Comparison | undefined>;
  ensureDefaultProfileChart: () => Promise<Chart>;
  ensureMatchCandidateCharts: () => Promise<MatchCandidate[]>;
  /** Phase 8G: list users eligible for directory search (discoverable + have primary chart). Optional; when absent, directory uses match candidates only. */
  listDirectoryEligibleUsers?: () => Promise<DirectoryEligibleUser[]>;
  /** Phase 8G: update discoverability / show_in_feed. Optional. */
  updateUserDiscoverability?: (userId: string, opts: { discoverable?: boolean; show_in_feed?: boolean }) => Promise<void>;
};

function createDefaultAdapter(): StorageAdapter {
  // When Postgres is configured, prefer durable pg-store adapter.
  if (process.env.POSTGRES_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pgStore = require('../../lib/pg-store') as PgStoreModule;
      const adapter: StorageAdapter = {
        createUser: pgStore.createUser,
        getUser: pgStore.getUser,
        getUserByHandle: pgStore.getUserByHandle,
        setUserPrimaryChart: pgStore.setUserPrimaryChart,
        getUserPrimaryChart: pgStore.getUserPrimaryChart,
        createChart: pgStore.createChart,
        getChart: pgStore.getChart,
        listChartsByOwner: pgStore.listChartsByOwner,
        createComparison: pgStore.createComparison,
        getComparison: pgStore.getComparison,
        ensureDefaultProfileChart: pgStore.ensureDefaultProfileChart,
        ensureMatchCandidateCharts: pgStore.ensureMatchCandidateCharts,
        listDirectoryEligibleUsers: pgStore.listDirectoryEligibleUsers,
        updateUserDiscoverability: pgStore.updateUserDiscoverability,
      };
      (adapter as any).__compatName = 'pg-store';
      // eslint-disable-next-line no-console
      console.log('[compat][storage] initialized Postgres adapter', {
        hasPostgresUrl: true,
      });
      return adapter;
    } catch (e) {
      // Fail-closed when Postgres is expected but adapter cannot be initialized.
      // eslint-disable-next-line no-console
      console.error('[compat][storage] FAILED to initialize Postgres adapter', {
        hasPostgresUrl: true,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  const adapter = memoryStore as unknown as StorageAdapter;
  (adapter as any).__compatName = (adapter as any).__compatName || 'memory';
  return adapter;
}

let adapter: StorageAdapter = createDefaultAdapter();

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
