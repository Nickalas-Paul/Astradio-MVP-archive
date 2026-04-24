import { getApiBaseUrl } from '../../core/api-base';

/** Single fetch, no retries — for Community artifact pages only. */
export async function createExportAudioObjectUrl(exportId: string): Promise<{ objectUrl: string } | { error: true }> {
  const id = String(exportId || '').trim();
  if (!/^[a-f0-9]{64}$/.test(id)) return { error: true as const };
  const base = getApiBaseUrl() || '';
  const res = await fetch(`${base}/api/exports/${encodeURIComponent(id)}`, { credentials: 'same-origin' });
  if (!res.ok) return { error: true as const };
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) return { error: true as const };
  const ct = res.headers.get('content-type') || 'audio/wav';
  const blob = new Blob([buf], { type: ct });
  return { objectUrl: URL.createObjectURL(blob) };
}
