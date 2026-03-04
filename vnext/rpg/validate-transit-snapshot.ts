// vnext/rpg/validate-transit-snapshot.ts
// Fail-closed structural validation for EphemerisSnapshot at API boundary.
// No seed computation; no heavy logic. Reject invalid input with clear 400-style errors.

import type { EphemerisSnapshot } from '../contracts';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function requireArray(obj: Record<string, unknown>, key: string, minLength?: number): unknown[] {
  const val = obj[key];
  if (!Array.isArray(val)) {
    throw new Error(`transitSnapshot.${key} must be an array`);
  }
  if (minLength != null && val.length < minLength) {
    throw new Error(`transitSnapshot.${key} must have at least ${minLength} elements`);
  }
  return val;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const val = obj[key];
  if (typeof val !== 'number' || Number.isNaN(val)) {
    throw new Error(`transitSnapshot.${key} must be a number`);
  }
  return val;
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const val = obj[key];
  if (typeof val !== 'string') {
    throw new Error(`transitSnapshot.${key} must be a string`);
  }
  return val;
}

/**
 * Validates that raw is a minimal EphemerisSnapshot-like structure required for
 * hashSnapshot and downstream transit logic. Throws with a clear message on failure.
 * Does not fix or coerce; reject invalid input.
 */
export function validateTransitSnapshot(raw: unknown): asserts raw is EphemerisSnapshot {
  if (!isObject(raw)) {
    throw new Error('transitSnapshot must be an object');
  }

  requireString(raw, 'ts');
  requireString(raw, 'tz');
  requireNumber(raw, 'lat');
  requireNumber(raw, 'lon');
  requireString(raw, 'houseSystem');

  const planets = requireArray(raw, 'planets');
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    if (!isObject(p)) {
      throw new Error(`transitSnapshot.planets[${i}] must be an object with name and lon`);
    }
    if (typeof (p as any).name !== 'string') {
      throw new Error(`transitSnapshot.planets[${i}].name must be a string`);
    }
    if (typeof (p as any).lon !== 'number' || Number.isNaN((p as any).lon)) {
      throw new Error(`transitSnapshot.planets[${i}].lon must be a number`);
    }
  }

  const houses = requireArray(raw, 'houses', 12);
  for (let i = 0; i < 12; i++) {
    if (typeof houses[i] !== 'number' || Number.isNaN(houses[i] as number)) {
      throw new Error(`transitSnapshot.houses[${i}] must be a number`);
    }
  }

  requireArray(raw, 'aspects');
  requireNumber(raw, 'moonPhase');

  const dominant = raw.dominantElements;
  if (!isObject(dominant)) {
    throw new Error('transitSnapshot.dominantElements must be an object');
  }
  const elements = ['fire', 'earth', 'air', 'water'] as const;
  for (const k of elements) {
    if (typeof (dominant as any)[k] !== 'number' || Number.isNaN((dominant as any)[k])) {
      throw new Error(`transitSnapshot.dominantElements.${k} must be a number`);
    }
  }
}
