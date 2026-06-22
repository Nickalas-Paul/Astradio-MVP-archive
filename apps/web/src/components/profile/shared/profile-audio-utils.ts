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

/** True when the user has not yet synced/heard identity audio for this chart locally. */
export function isFirstIdentityListen(chartId: string): boolean {
  if (!chartId) return false;
  return getIdentityAudioChartSync(chartId) === null;
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
