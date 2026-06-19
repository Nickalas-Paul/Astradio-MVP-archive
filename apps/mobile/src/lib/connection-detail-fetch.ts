import { API_BASE, api } from './api';
import { getToken } from './token-storage';
import type { EphemerisSnapshot } from '../types/my-sky';

export type RelationshipRow = {
  id: string;
  ownerUserId: string;
  chartIdLow: string;
  chartIdHigh: string;
  label?: string;
  comparisonId?: string | null;
};

export type MaterializeResponse = {
  ok?: boolean;
  relationshipId?: string;
  comparisonId?: string;
  compositeArtifactId?: string;
  exportJobId?: string;
  error?: string;
};

export type ComparisonJson = {
  id?: string;
  relationshipMode?: string;
  compatibilityText?: { short?: string; long?: string; bullets?: string[] } | string;
  exportJobId?: string;
};

export type ChartSnapshotResponse = {
  snapshot?: EphemerisSnapshot;
};

export type GenerateAudioResponse = {
  exportId?: string;
  status?: string;
  error?: string;
  message?: string;
};

const EXPORT_ID_RE = /^[a-f0-9]{64}$/;

export function isValidExportId(id: string | null | undefined): id is string {
  return typeof id === 'string' && EXPORT_ID_RE.test(id.trim());
}

export function parseCompatibilityText(comparison: ComparisonJson | null): {
  short: string;
  long: string;
  bullets: string[];
} {
  if (!comparison) return { short: '', long: '', bullets: [] };
  const raw = comparison.compatibilityText;
  if (typeof raw === 'string') {
    return { short: raw, long: '', bullets: [] };
  }
  if (raw && typeof raw === 'object') {
    return {
      short: raw.short || '',
      long: raw.long || '',
      bullets: Array.isArray(raw.bullets) ? raw.bullets.filter((b) => String(b).trim()) : [],
    };
  }
  return { short: '', long: '', bullets: [] };
}

export async function fetchRelationship(relationshipId: string): Promise<RelationshipRow> {
  return api<RelationshipRow>(`/api/relationships/${encodeURIComponent(relationshipId)}`);
}

export async function materializeRelationship(relationshipId: string): Promise<MaterializeResponse> {
  return api<MaterializeResponse>(
    `/api/relationships/${encodeURIComponent(relationshipId)}/materialize`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export async function fetchComparison(comparisonId: string): Promise<ComparisonJson> {
  return api<ComparisonJson>(`/api/comparisons/${encodeURIComponent(comparisonId)}`);
}

export async function fetchChartSnapshot(chartId: string): Promise<EphemerisSnapshot | null> {
  const response = await api<ChartSnapshotResponse>(
    `/api/charts/${encodeURIComponent(chartId)}/snapshot`
  );
  return response.snapshot ?? null;
}

export async function checkExportAvailability(exportId: string): Promise<boolean> {
  const token = await getToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}/api/exports/${encodeURIComponent(exportId)}`, {
    method: 'HEAD',
    headers,
  });
  return response.status === 200 || response.status === 204;
}

export async function generateConnectionAudio(relationshipId: string): Promise<string> {
  const data = await api<GenerateAudioResponse>(
    `/api/relationships/${encodeURIComponent(relationshipId)}/audio`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  const exportId = typeof data.exportId === 'string' ? data.exportId.trim() : '';
  if (!isValidExportId(exportId)) {
    throw {
      status: 500,
      error: typeof data.error === 'string' ? data.error : 'Could not generate connection audio',
    };
  }
  return exportId;
}

export function resolveViewerPeerChartIds(
  relationship: RelationshipRow,
  viewerChartId: string | null
): { viewerChartId: string; peerChartId: string } | null {
  const low = relationship.chartIdLow?.trim() || '';
  const high = relationship.chartIdHigh?.trim() || '';
  if (!low || !high || !viewerChartId) return null;
  if (viewerChartId === low) return { viewerChartId: low, peerChartId: high };
  if (viewerChartId === high) return { viewerChartId: high, peerChartId: low };
  return null;
}
