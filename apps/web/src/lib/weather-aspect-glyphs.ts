import { normalizePlanetName } from '@/core/planet-identity';

const ASPECT_VERB =
  '(?:conjuncts|opposes|squares|trines|sextiles)';

const PREFIX_PATTERNS = [
  new RegExp(`^Your transiting (.+?) ${ASPECT_VERB} their natal (.+)$`, 'i'),
  new RegExp(`^Their transiting (.+?) ${ASPECT_VERB} your natal (.+)$`, 'i'),
  new RegExp(`^Transiting (.+?) ${ASPECT_VERB} natal (.+)$`, 'i'),
];

/** Parse transit + natal planet display names from activation line prefix text. */
export function parseWeatherAspectPlanets(prefix: string): { transit: string; natal: string } | null {
  const t = prefix.trim();
  if (!t) return null;
  for (const re of PREFIX_PATTERNS) {
    const m = t.match(re);
    if (m?.[1] && m?.[2]) {
      return { transit: m[1].trim(), natal: m[2].trim() };
    }
  }
  return null;
}

export function planetDisplayNameToKey(displayName: string): string {
  return normalizePlanetName(displayName.replace(/^(the|a)\s+/i, ''));
}
