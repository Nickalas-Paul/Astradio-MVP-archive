import { getApiBaseUrl } from '../../core/api-base';

const EXPORT_ID_RE = /^[a-f0-9]{64}$/;

/** HEAD check — matches Library panel export availability pattern. */
export async function exportAudioHeadAvailable(exportId: string): Promise<boolean> {
  const id = String(exportId || '').trim();
  if (!EXPORT_ID_RE.test(id)) return false;
  const base = getApiBaseUrl() || '';
  try {
    const res = await fetch(`${base}/api/exports/${encodeURIComponent(id)}`, {
      method: 'HEAD',
      credentials: 'same-origin',
    });
    return res.status === 200 || res.status === 204;
  } catch {
    return false;
  }
}
