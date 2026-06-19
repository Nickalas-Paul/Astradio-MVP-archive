export const CHART_IMPORT_UNAVAILABLE_MSG =
  "This chart isn't available for import. Connect with this person first, or enter their birth data manually.";

export function chartApiRecordHasEngineBirthFields(chart: Record<string, unknown>): boolean {
  if (!chart || typeof chart !== 'object') return false;
  const date = typeof chart.date === 'string' ? chart.date.trim() : '';
  const timeRaw = typeof chart.time === 'string' ? chart.time.trim() : '';
  const time = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : timeRaw;
  const lat =
    typeof chart.lat === 'number' && Number.isFinite(chart.lat)
      ? chart.lat
      : typeof (chart as { location?: { lat?: unknown } }).location?.lat === 'number' &&
          Number.isFinite((chart as { location: { lat: number } }).location.lat)
        ? (chart as { location: { lat: number } }).location.lat
        : null;
  const lon =
    typeof chart.lon === 'number' && Number.isFinite(chart.lon)
      ? chart.lon
      : typeof (chart as { location?: { lon?: unknown } }).location?.lon === 'number' &&
          Number.isFinite((chart as { location: { lon: number } }).location.lon)
        ? (chart as { location: { lon: number } }).location.lon
        : null;
  return Boolean(date && date.length >= 8 && time && time.length >= 4 && lat != null && lon != null);
}

export function chartApiRecordToBirthWire(chart: Record<string, unknown>): {
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone: string;
  houseSystem: string;
  location: { label: string; lat: number; lon: number; timezone: string };
} {
  const date = String(chart.date ?? '').trim();
  const timeRaw = String(chart.time ?? '').trim();
  const time = timeRaw.length >= 5 ? timeRaw.slice(0, 5) : timeRaw;
  const lat =
    typeof chart.lat === 'number'
      ? chart.lat
      : ((chart as { location?: { lat?: number } }).location?.lat ?? 0);
  const lon =
    typeof chart.lon === 'number'
      ? chart.lon
      : ((chart as { location?: { lon?: number } }).location?.lon ?? 0);
  const loc = (chart as { location?: { label?: string; timezone?: string } }).location;
  const timezone =
    typeof chart.tz === 'string'
      ? chart.tz
      : typeof loc?.timezone === 'string'
        ? loc.timezone
        : 'UTC';
  const label = typeof loc?.label === 'string' ? loc.label : 'Imported chart';
  return {
    date,
    time,
    lat,
    lon,
    timezone,
    houseSystem: typeof chart.houseSystem === 'string' ? chart.houseSystem : 'placidus',
    location: { label, lat, lon, timezone },
  };
}

export function chartApiOwnerDisplayLabel(chart: Record<string, unknown>): string {
  const display =
    typeof chart.displayName === 'string'
      ? chart.displayName
      : typeof chart.display_name === 'string'
        ? chart.display_name
        : '';
  if (display.trim()) return display.trim();
  const handle = typeof chart.handle === 'string' ? chart.handle.trim() : '';
  if (handle) return handle.startsWith('@') ? handle : `@${handle}`;
  return 'Imported chart';
}

function serializeNumberForHash(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  throw new Error('Crypto unavailable for chart hash');
}

export async function combinedChartIdOverridesSeed(
  chartId: string,
  overrides?: Record<string, { lon: number }>
): Promise<string> {
  const planets = overrides ?? {};
  const sortedKeys = Object.keys(planets).sort((a, b) => a.localeCompare(b));
  const planetObj: Record<string, { lonDeg: string }> = {};
  for (const k of sortedKeys) {
    const v = planets[k];
    if (v && typeof v.lon === 'number' && Number.isFinite(v.lon)) {
      planetObj[k] = { lonDeg: serializeNumberForHash(v.lon) };
    }
  }
  const oh = await sha256Hex(JSON.stringify({ planets: planetObj, angles: {} }));
  return sha256Hex(`${chartId.trim()}|${oh}`);
}
