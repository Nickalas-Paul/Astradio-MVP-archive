/**
 * Retrograde detection for RPG stat derivation.
 * Uses planetary speed from EphemerisSnapshot when present.
 */

const NEVER_RETROGRADE = new Set(['sun', 'moon']);

/**
 * True when the body is retrograde.
 * Sun/Moon always false. Undefined speed → false (assume direct).
 */
export function isRetrograde(body: string, speed: number | undefined): boolean {
  const key = body.trim().toLowerCase();
  if (NEVER_RETROGRADE.has(key)) return false;
  if (typeof speed !== 'number' || !Number.isFinite(speed)) {
    if (speed !== undefined) {
      // eslint-disable-next-line no-console
      console.warn(`[rpg-retrograde] Non-finite speed for ${key}; assuming direct`);
    }
    return false;
  }
  return speed < 0;
}

/** Flat multiplier applied to all stat contributions from a retrograde planet. */
export const RETROGRADE_MULTIPLIER = 0.85;
export const DIRECT_MULTIPLIER = 1.0;

export function retrogradeMultiplier(body: string, speed: number | undefined): number {
  return isRetrograde(body, speed) ? RETROGRADE_MULTIPLIER : DIRECT_MULTIPLIER;
}
