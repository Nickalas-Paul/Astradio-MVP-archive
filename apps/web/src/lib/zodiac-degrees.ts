import { SIGN_GLYPH } from '@/components/wheel/wheel-constants';

export const SIGN_NAMES = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

/** Internal storage is 0–360° (canonical longitude). User-facing is sign + 0–29° (and minutes). */
/** Minute-level zodiac breakdown for wheel cusp labels. */
export function lonToSignDegMin(lon: number): {
  signIndex: number;
  glyph: string;
  degree: number;
  minutes: number;
} {
  const n = ((lon % 360) + 360) % 360;
  const signIndex = Math.floor(n / 30) % 12;
  const degInSign = n % 30;
  const degree = Math.floor(degInSign);
  let minutes = Math.round((degInSign - degree) * 60);
  let adjDegree = degree;
  if (minutes >= 60) {
    minutes = 0;
    adjDegree += 1;
  }
  return {
    signIndex,
    glyph: SIGN_GLYPH[signIndex] ?? '',
    degree: adjDegree,
    minutes,
  };
}

export function formatCuspDegreeLabel(lon: number): string {
  const { degree, minutes, glyph } = lonToSignDegMin(lon);
  const degStr = String(degree).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  return `${degStr}\u00B0${minStr}' ${glyph}`;
}

export function lonToSignDeg(lonDeg: number): { signIdx: number; sign: string; deg: number; min: number } {
  const n = ((lonDeg % 360) + 360) % 360;
  const signIdx = Math.floor(n / 30) % 12;
  const degInSign = n % 30;
  const deg = Math.floor(degInSign);
  const min = Math.round((degInSign - deg) * 60);
  return {
    signIdx,
    sign: SIGN_NAMES[signIdx],
    deg,
    min,
  };
}

/** Convert astrology-native (sign + degree within sign + minutes) to canonical 0–360 longitude. */
export function signDegToLon(signIdx: number, deg: number, min: number): number {
  const d = Math.max(0, Math.min(29, deg)) + Math.max(0, Math.min(59, min)) / 60;
  return (signIdx % 12) * 30 + d;
}

export function roundZodiacDegree(lonDeg: number): number {
  return Math.round(lonDeg * 10) / 10;
}
