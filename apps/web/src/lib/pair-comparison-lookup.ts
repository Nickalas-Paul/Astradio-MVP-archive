import { getApiBaseUrl } from '@/core/api-base';

export type ComparisonPairLookupResult = {
  exists: boolean;
  comparisonId?: string;
  relationshipId?: string;
};

/** Deterministic Listen seed when both slots use stored chart IDs. */
export function buildListenPairSeed(chartAId: string | null, chartBId: string | null): string {
  if (chartAId && chartBId) {
    const sortedIds = [chartAId, chartBId].sort();
    return `listen_${sortedIds[0]}_${sortedIds[1]}`;
  }
  return `listen_${chartAId || 'manual'}_${chartBId || 'manual'}_${Date.now()}`;
}

export function storedChartIdsFromSlots(
  slots: Array<{ chart_id?: string | null }>
): { chartAId: string; chartBId: string } | null {
  const ids = slots.map((s) => String(s.chart_id || '').trim()).filter(Boolean);
  if (ids.length < 2) return null;
  return { chartAId: ids[0], chartBId: ids[1] };
}

export async function fetchComparisonPairLookup(
  chartAId: string,
  chartBId: string
): Promise<ComparisonPairLookupResult> {
  const base = getApiBaseUrl();
  const qs = new URLSearchParams({ chartA: chartAId, chartB: chartBId });
  const r = await fetch(`${base}/api/comparisons/lookup?${qs.toString()}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = (await r.json().catch(() => ({}))) as ComparisonPairLookupResult & { error?: string };
  if (!r.ok) {
    return { exists: false };
  }
  return data;
}
