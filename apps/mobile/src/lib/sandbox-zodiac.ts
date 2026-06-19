import { ZODIAC_SIGNS } from '../constants/wheel-constants';

export const SIGN_NAMES = [...ZODIAC_SIGNS];

export function lonToSignDeg(lonDeg: number): { signIdx: number; sign: string; deg: number; min: number } {
  const n = ((lonDeg % 360) + 360) % 360;
  const signIdx = Math.floor(n / 30) % 12;
  const degInSign = n % 30;
  const deg = Math.floor(degInSign);
  const min = Math.round((degInSign - deg) * 60);
  return { signIdx, sign: SIGN_NAMES[signIdx]!, deg, min };
}

export function signDegToLon(signIdx: number, deg: number, min: number): number {
  const d = Math.max(0, Math.min(29, deg)) + Math.max(0, Math.min(59, min)) / 60;
  return (signIdx % 12) * 30 + d;
}

export function roundSandboxDegree(lonDeg: number): number {
  return Math.round(lonDeg * 10) / 10;
}

function normLon(lon: number): number {
  let value = lon % 360;
  if (value < 0) value += 360;
  return value;
}

/** House number (1–12) for a longitude given 12 cusps. */
export function lonToHouse(lon: number, cusps: number[]): number | null {
  if (cusps.length < 12) return null;
  const x = normLon(lon);
  for (let index = 0; index < 12; index++) {
    const start = normLon(cusps[index]!);
    const end = normLon(cusps[(index + 1) % 12]!);
    const inSegment = start <= end ? x >= start && x < end : x >= start || x < end;
    if (inSegment) return index + 1;
  }
  return 1;
}
