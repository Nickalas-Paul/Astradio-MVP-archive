/**
 * Chart shape required by the wheel renderer.
 * Backend /chart returns { positions, cusps }; compose may return controls without chart data.
 */
export type ChartForWheel = {
  positions: Record<string, number>;
  cusps: number[];
  asc?: number;
};

/**
 * Normalize backend/compose payload into ChartForWheel.
 * Accepts: { positions, cusps }, or { planets: [{ name, lon }], houses }, or compatible shapes.
 * Returns null with console error listing missing keys when invalid.
 */
export function normalizeChartForWheel(raw: unknown): ChartForWheel | null {
  if (raw == null || typeof raw !== 'object') {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[WheelCanvas] normalizeChartForWheel: raw is null or not object', { raw });
    }
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Backend /chart and some compose responses: { positions, cusps }
  let positions: Record<string, number> = {};
  let cusps: number[] = [];

  if (obj.positions != null && typeof obj.positions === 'object' && !Array.isArray(obj.positions)) {
    const p = obj.positions as Record<string, unknown>;
    for (const [k, v] of Object.entries(p)) {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      if (Number.isFinite(n)) positions[k] = n;
    }
  }

  if (obj.cusps != null && Array.isArray(obj.cusps)) {
    cusps = obj.cusps
      .slice(0, 12)
      .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
      .filter(Number.isFinite);
  }

  // Alternative: planets array + houses
  if ((!positions || Object.keys(positions).length === 0) && Array.isArray(obj.planets)) {
    for (const entry of obj.planets) {
      if (entry && typeof entry === 'object') {
        const name = (entry as { name?: string }).name ?? (entry as { id?: string }).id;
        const lon = (entry as { lon?: number }).lon ?? (entry as { longitude?: number }).longitude;
        if (name && Number.isFinite(lon)) positions[name] = Number(lon);
      }
    }
  }
  if (cusps.length < 12 && Array.isArray(obj.houses)) {
    cusps = obj.houses
      .slice(0, 12)
      .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
      .filter(Number.isFinite);
  }

  // Ensure 12 cusps (equal house fallback)
  if (cusps.length < 12) {
    const asc = typeof obj.asc === 'number' ? obj.asc : cusps[0] ?? 0;
    cusps = Array.from({ length: 12 }, (_, i) => (asc + i * 30) % 360);
  }

  if (Object.keys(positions).length === 0 || cusps.length !== 12) {
    const missing: string[] = [];
    if (Object.keys(positions).length === 0) missing.push('positions (or planets array)');
    if (cusps.length !== 12) missing.push('cusps (12 numbers)');
    console.warn('[WheelCanvas] Invalid chart data structure. Missing or invalid:', missing.join(', '), 'Keys:', Object.keys(obj));
    return null;
  }

  const asc = typeof obj.asc === 'number' ? obj.asc : cusps[0];
  return { positions, cusps, asc };
}
