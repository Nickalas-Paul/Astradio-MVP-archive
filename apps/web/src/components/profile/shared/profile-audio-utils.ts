const identityAudioSyncKey = (chartId: string) => `astradio_identity_audio_sync_${chartId}`;

export function getIdentityAudioChartSync(chartId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(identityAudioSyncKey(chartId));
  } catch {
    return null;
  }
}

export function setIdentityAudioChartSync(chartId: string, chartUpdatedAt: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(identityAudioSyncKey(chartId), chartUpdatedAt);
  } catch {
    // ignore quota / private mode
  }
}

/** True when chart row changed after the last identity audio we synced locally. */
export function isChartUpdatedSinceLastIdentityAudio(
  chartId: string,
  chartUpdatedAt: string | undefined,
): boolean {
  if (!chartId || !chartUpdatedAt) return false;
  const sync = getIdentityAudioChartSync(chartId);
  if (!sync) return false;
  return sync !== chartUpdatedAt;
}

export async function blobUrlFromComposePayload(
  base: string,
  composePayload: Record<string, unknown>
): Promise<string | null> {
  const audio = composePayload?.audio as Record<string, unknown> | undefined;
  const base64 = audio?.base64;
  if (typeof base64 === 'string' && base64.length > 0) {
    try {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
  const exportId = (composePayload?.export_id ?? audio?.export_id) as string | undefined;
  if (typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId)) {
    try {
      const exportRes = await fetch(`${base || ''}/api/exports/${exportId}`, { credentials: 'same-origin' });
      if (exportRes.ok) {
        const ab = await exportRes.arrayBuffer();
        if (ab.byteLength > 0) {
          const blob = new Blob([ab], { type: exportRes.headers.get('content-type') || 'audio/wav' });
          return URL.createObjectURL(blob);
        }
      }
    } catch {
      return null;
    }
  }
  return null;
}
