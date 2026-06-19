export type ChartForWheel = {
  positions: Record<string, number>;
  cusps: number[];
  asc?: number;
};

export function normalizeChartForWheel(raw: unknown): ChartForWheel | null {
  if (raw == null || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;
  let positions: Record<string, number> = {};
  let cusps: number[] = [];

  if (obj.positions != null && typeof obj.positions === 'object' && !Array.isArray(obj.positions)) {
    for (const [key, value] of Object.entries(obj.positions as Record<string, unknown>)) {
      const n = typeof value === 'number' ? value : parseFloat(String(value));
      if (Number.isFinite(n)) positions[key.toLowerCase()] = n;
    }
  }

  if (Array.isArray(obj.cusps)) {
    cusps = obj.cusps
      .slice(0, 12)
      .map((value) => (typeof value === 'number' ? value : parseFloat(String(value))))
      .filter(Number.isFinite);
  }

  if (Object.keys(positions).length === 0 && Array.isArray(obj.planets)) {
    for (const entry of obj.planets) {
      if (!entry || typeof entry !== 'object') continue;
      const name = String((entry as { name?: string }).name ?? '').toLowerCase();
      const lon =
        (entry as { lon?: number }).lon ?? (entry as { longitude?: number }).longitude;
      if (name && typeof lon === 'number' && Number.isFinite(lon)) {
        positions[name] = lon;
      }
    }
  }

  if (cusps.length < 12 && Array.isArray(obj.houses)) {
    cusps = obj.houses
      .slice(0, 12)
      .map((value) => (typeof value === 'number' ? value : parseFloat(String(value))))
      .filter(Number.isFinite);
  }

  if (cusps.length < 12) {
    const asc = typeof obj.asc === 'number' ? obj.asc : cusps[0] ?? 0;
    cusps = Array.from({ length: 12 }, (_, index) => (asc + index * 30) % 360);
  }

  if (Object.keys(positions).length === 0 || cusps.length !== 12) {
    return null;
  }

  const asc = typeof obj.asc === 'number' ? obj.asc : cusps[0];
  return { positions, cusps, asc };
}
