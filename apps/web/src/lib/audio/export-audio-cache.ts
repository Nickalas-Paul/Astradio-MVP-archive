import { getApiBaseUrl } from '../../core/api-base';

const EXPORT_ID_RE = /^[a-f0-9]{64}$/;

const cache = new Map<string, string>();

export async function resolveExportUrl(exportId: string): Promise<string> {
  const id = String(exportId || '').trim();
  if (!EXPORT_ID_RE.test(id)) {
    throw new Error('Invalid export id');
  }

  const cached = cache.get(id);
  if (cached) return cached;

  const base = getApiBaseUrl() || '';
  const res = await fetch(`${base}/api/exports/${encodeURIComponent(id)}`, {
    credentials: 'same-origin',
  });

  if (!res.ok) throw new Error(`Export fetch failed: ${res.status}`);

  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) throw new Error('Export fetch failed: empty body');

  const ct = res.headers.get('content-type') || 'audio/wav';
  const blob = new Blob([buf], { type: ct });
  const url = URL.createObjectURL(blob);
  cache.set(id, url);
  return url;
}

export function isExportCached(exportId: string): boolean {
  const id = String(exportId || '').trim();
  return EXPORT_ID_RE.test(id) && cache.has(id);
}

export function clearExportCache(): void {
  for (const url of cache.values()) {
    URL.revokeObjectURL(url);
  }
  cache.clear();
}
