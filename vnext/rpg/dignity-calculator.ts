/**
 * Classical dignity multipliers for RPG stat derivation.
 * Outer-planet dignities use modern consensus; unresolved cases default to neutral.
 */

export type DignityLabel = 'domicile' | 'exaltation' | 'neutral' | 'detriment' | 'fall';

const DOMICILE: Record<string, readonly string[]> = {
  sun: ['leo'],
  moon: ['cancer'],
  mercury: ['gemini', 'virgo'],
  venus: ['taurus', 'libra'],
  mars: ['aries', 'scorpio'],
  jupiter: ['sagittarius', 'pisces'],
  saturn: ['capricorn', 'aquarius'],
  uranus: ['aquarius'],
  neptune: ['pisces'],
  pluto: ['scorpio'],
};

const EXALTATION: Record<string, readonly string[]> = {
  sun: ['aries'],
  moon: ['taurus'],
  mercury: ['virgo'],
  venus: ['pisces'],
  mars: ['capricorn'],
  jupiter: ['cancer'],
  saturn: ['libra'],
  uranus: ['scorpio'],
  neptune: ['cancer'],
  pluto: ['leo'],
};

const DETRIMENT: Record<string, readonly string[]> = {
  sun: ['aquarius'],
  moon: ['capricorn'],
  mercury: ['sagittarius', 'pisces'],
  venus: ['aries', 'scorpio'],
  mars: ['taurus', 'libra'],
  jupiter: ['gemini', 'virgo'],
  saturn: ['cancer', 'leo'],
  uranus: ['leo'],
  neptune: ['virgo'],
  pluto: ['taurus'],
};

const FALL: Record<string, readonly string[]> = {
  sun: ['libra'],
  moon: ['scorpio'],
  mercury: ['pisces'],
  venus: ['virgo'],
  mars: ['cancer'],
  jupiter: ['capricorn'],
  saturn: ['aries'],
  uranus: ['taurus'],
  neptune: ['capricorn'],
  // Pluto fall is debated — omit (neutral)
};

const MULTIPLIER: Record<DignityLabel, number> = {
  domicile: 1.3,
  exaltation: 1.2,
  neutral: 1.0,
  detriment: 0.8,
  fall: 0.7,
};

function normSign(sign: string): string {
  return sign.trim().toLowerCase();
}

function normBody(body: string): string {
  return body.trim().toLowerCase();
}

function includesSign(table: Record<string, readonly string[]>, body: string, sign: string): boolean {
  const signs = table[body];
  return Array.isArray(signs) && signs.includes(sign);
}

/** Resolve classical (or modern-consensus) dignity label for a body in a sign. */
export function getDignityLabel(body: string, sign: string): DignityLabel {
  const b = normBody(body);
  const s = normSign(sign);
  if (!b || !s) return 'neutral';
  // Domicile before exaltation when both could apply (e.g. Mercury in Virgo).
  if (includesSign(DOMICILE, b, s)) return 'domicile';
  if (includesSign(EXALTATION, b, s)) return 'exaltation';
  if (includesSign(FALL, b, s)) return 'fall';
  if (includesSign(DETRIMENT, b, s)) return 'detriment';
  return 'neutral';
}

/** Dignity strength multiplier: 1.3 / 1.2 / 1.0 / 0.8 / 0.7. */
export function getDignityMultiplier(body: string, sign: string): number {
  return MULTIPLIER[getDignityLabel(body, sign)];
}
