import { api } from './api';
import { buildMySkyScreenData } from './my-sky-mappers';
import type {
  LibraryCompositionRow,
  MySkyScreenData,
  ProfileChartResponse,
  ProfileResponse,
} from '../types/my-sky';
import type { SavedCompositionDetail } from '../types/sandbox';

function sortLibraryRows(rows: LibraryCompositionRow[]): LibraryCompositionRow[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(String(a.created_at ?? 0)).getTime();
    const tb = new Date(String(b.created_at ?? 0)).getTime();
    return tb - ta;
  });
}

function compositionsQuery(userId: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({
    limit: '50',
    userId,
    ...extra,
  });
  return `/api/sandbox/compositions?${params.toString()}`;
}

export async function fetchMySkyScreenData(): Promise<MySkyScreenData> {
  const profile = await api<ProfileResponse>('/api/profile');
  if (!profile.user?.id) {
    throw { status: 401, error: 'not_authenticated' };
  }

  const userId = profile.user.id;
  const chartId = profile.primaryChart?.id;
  let chart: ProfileChartResponse | null = null;
  if (chartId) {
    try {
      chart = await api<ProfileChartResponse>(
        `/api/profile/chart?chartId=${encodeURIComponent(chartId)}`
      );
    } catch {
      chart = null;
    }
  }

  let library: LibraryCompositionRow[] = [];
  let libraryError: string | null = null;
  try {
    const rows = await api<LibraryCompositionRow[]>(compositionsQuery(userId));
    library = sortLibraryRows(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.warn('[Library] fetch failed:', err);
    libraryError = 'Could not load your library';
    library = [];
  }

  return buildMySkyScreenData({ profile, chart, library, libraryError });
}

export async function fetchLibraryDetail(id: string, userId: string): Promise<SavedCompositionDetail> {
  const params = new URLSearchParams({ userId });
  return api<SavedCompositionDetail>(
    `/api/sandbox/compositions/${encodeURIComponent(id)}?${params.toString()}`
  );
}

export async function deleteLibraryComposition(id: string, userId: string): Promise<void> {
  const params = new URLSearchParams({ userId });
  await api(`/api/sandbox/compositions/${encodeURIComponent(id)}?${params.toString()}`, {
    method: 'DELETE',
  });
}
