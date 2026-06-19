import { api } from './api';

export type GeocodeResult = {
  label: string;
  lat: number;
  lon: number;
  timezone: string;
};

/** Engine geocoder: GET /geocode?q= (same source as web LocationFinder via /api/geocode proxy). */
export async function searchGeocode(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const data = await api<GeocodeResult[] | { error?: string }>(
    `/geocode?q=${encodeURIComponent(trimmed)}`
  );

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(
    (item) =>
      typeof item.label === 'string' &&
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lon) &&
      typeof item.timezone === 'string' &&
      item.timezone.trim().length > 0
  );
}
