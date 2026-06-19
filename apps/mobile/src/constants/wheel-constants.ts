export const ZODIAC_SIGNS = [
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

export const SIGN_GLYPH: Record<number, string> = {
  0: '♈',
  1: '♉',
  2: '♊',
  3: '♋',
  4: '♌',
  5: '♍',
  6: '♎',
  7: '♏',
  8: '♐',
  9: '♑',
  10: '♒',
  11: '♓',
};

export const PLANET_GLYPH: Record<string, string> = {
  sun: '☉',
  moon: '☽',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
  northnode: '☊',
  north_node: '☊',
  chiron: '⚷',
};

export const BODY_DISPLAY_ORDER = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'northnode',
  'north_node',
  'chiron',
] as const;

export const WHEEL_COLORS = {
  outerRingStroke: '#4a5a7a',
  houseStroke: '#3d4f6e',
  houseFill: '#1a2435',
  zodiacFillA: '#151B24',
  zodiacFillB: '#1A222E',
  zodiacGlyphFill: '#94A3B8',
  angleLabelFill: '#0e9696',
  aspectFallback: '#6a7a8a',
  houseNumberFill: '#64748B',
} as const;

export const ASPECT_LINE_COLOR: Record<string, string> = {
  conjunction: '#b8a070',
  sextile: '#6b9bb8',
  square: '#c66b6b',
  trine: '#4a9b7a',
  opposition: '#9470b8',
};
