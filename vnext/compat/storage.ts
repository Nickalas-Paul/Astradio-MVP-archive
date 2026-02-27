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
};

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
