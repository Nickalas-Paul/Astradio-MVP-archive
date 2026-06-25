import * as FileSystem from 'expo-file-system/legacy';
import { API_BASE } from './api';
import { getToken } from './token-storage';

const uriCache = new Map<string, string>();

export async function resolveLocalExportUri(exportId: string): Promise<string> {
  const cached = uriCache.get(exportId);
  if (cached) {
    const info = await FileSystem.getInfoAsync(cached);
    if (info.exists) {
      return cached;
    }
    uriCache.delete(exportId);
  }

  const token = await getToken();
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('cache_directory_unavailable');
  }

  const downloadUri = `${API_BASE}/api/exports/${encodeURIComponent(exportId)}`;
  const localUri = `${cacheDir}${exportId}.wav`;

  const existing = await FileSystem.getInfoAsync(localUri);
  if (existing.exists) {
    uriCache.set(exportId, localUri);
    return localUri;
  }

  const result = await FileSystem.downloadAsync(
    downloadUri,
    localUri,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`export_download_failed_${result.status}`);
  }

  uriCache.set(exportId, result.uri);
  return result.uri;
}
