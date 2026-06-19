import { api } from './api';
import { fetchChartSnapshot } from './connection-detail-fetch';
import type {
  ChartSearchResult,
  SavedComposition,
  SavedCompositionDetail,
} from '../types/sandbox';

export function filterSandboxSavedRows(rows: SavedComposition[]): SavedComposition[] {
  return rows.filter((row) => row?.source === 'sandbox');
}

export async function fetchSavedCompositions(userId: string): Promise<SavedComposition[]> {
  const data = await api<SavedComposition[]>(
    `/api/sandbox/compositions?limit=50&userId=${encodeURIComponent(userId)}`
  );
  const rows = Array.isArray(data) ? data : [];
  return filterSandboxSavedRows(rows);
}

export async function fetchCompositionDetail(
  id: string,
  userId: string
): Promise<SavedCompositionDetail> {
  return api<SavedCompositionDetail>(
    `/api/sandbox/compositions/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`
  );
}

export { fetchChartSnapshot };

export async function postSnapshot(
  birth: object,
  overrides?: object
): Promise<{ snapshot?: unknown; meta?: unknown }> {
  return api<{ snapshot?: unknown; meta?: unknown }>('/api/sandbox/snapshot', {
    method: 'POST',
    body: JSON.stringify({ birth, overrides: overrides ?? { planets: {} } }),
  });
}

export async function searchCharts(query: string, userId: string): Promise<ChartSearchResult[]> {
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('limit', '10');
  params.set('userId', userId);
  const data = await api<{ results?: ChartSearchResult[] }>(`/api/charts/search?${params.toString()}`);
  return Array.isArray(data.results) ? data.results : [];
}

export async function fetchChartRecord(chartId: string): Promise<Record<string, unknown>> {
  return api<Record<string, unknown>>(`/api/charts/${encodeURIComponent(chartId)}`);
}

export async function resolveComposition(body: object): Promise<Record<string, unknown>> {
  return api<Record<string, unknown>>('/api/sandbox/resolve', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function saveComposition(
  body: object,
  userId: string
): Promise<Record<string, unknown>> {
  return api<Record<string, unknown>>(
    `/api/sandbox/compositions?userId=${encodeURIComponent(userId)}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}
