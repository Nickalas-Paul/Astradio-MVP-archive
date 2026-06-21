/** Zodiac sign name → wheel sign index (0 = Aries). */
const SIGN_NAME_TO_INDEX: Record<string, number> = {
  aries: 0,
  taurus: 1,
  gemini: 2,
  cancer: 3,
  leo: 4,
  virgo: 5,
  libra: 6,
  scorpio: 7,
  sagittarius: 8,
  capricorn: 9,
  aquarius: 10,
  pisces: 11,
};

export function signNameToIndex(name: string | undefined | null): number | null {
  if (!name || typeof name !== 'string') return null;
  const idx = SIGN_NAME_TO_INDEX[name.trim().toLowerCase()];
  return idx === undefined ? null : idx;
}

export type PeerBigThreeSigns = {
  sun?: string;
  moon?: string;
  rising?: string;
};
