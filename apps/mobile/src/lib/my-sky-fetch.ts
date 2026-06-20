import { api } from './api';
import { buildMySkyScreenData } from './my-sky-mappers';
import type {
  LibraryCompositionRow,
  MySkyScreenData,
  ProfileChartResponse,
  ProfileResponse,
} from '../types/my-sky';
import type { SavedCompositionDetail } from '../types/sandbox';

export async function fetchMySkyScreenData(): Promise<MySkyScreenData> {
  const profile = await api<ProfileResponse>('/api/profile');
  if (!profile.user?.id) {
    throw { status: 401, error: 'not_authenticated' };
  }

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
  try {
    const rows = await api<LibraryCompositionRow[]>('/api/sandbox/compositions?limit=50');
    library = Array.isArray(rows) ? rows : [];
  } catch {
    library = [];
  }

  return buildMySkyScreenData({ profile, chart, library });
}

export async function fetchLibraryDetail(id: string): Promise<SavedCompositionDetail> {
  return api<SavedCompositionDetail>(`/api/sandbox/compositions/${encodeURIComponent(id)}`);
}
