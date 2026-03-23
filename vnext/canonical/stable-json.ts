import type { EphemerisSnapshot, FeatureVec } from '../contracts';

/** Deterministic JSON stringify for hashing (sorted keys). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((x) => stableStringify(x)).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]));
  return '{' + parts.join(',') + '}';
}

export function snapshotFingerprint(s: EphemerisSnapshot): string {
  return stableStringify({
    ts: s.ts,
    tz: s.tz,
    lat: s.lat,
    lon: s.lon,
    houseSystem: s.houseSystem,
    planets: s.planets,
    houses: s.houses,
    aspects: s.aspects,
    moonPhase: s.moonPhase,
    dominantElements: s.dominantElements,
  });
}

export function featureVecFingerprint(v: FeatureVec): string {
  return stableStringify(Array.from(v));
}
