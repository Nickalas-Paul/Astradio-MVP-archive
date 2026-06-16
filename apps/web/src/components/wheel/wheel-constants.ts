/** Canonical glyph set for all 15 supported bodies. */
export const PLANET_GLYPH: Record<string, string> = {
  sun: '\u2609',
  moon: '\u263D',
  mercury: '\u263F',
  venus: '\u2640',
  mars: '\u2642',
  jupiter: '\u2643',
  saturn: '\u2644',
  uranus: '\u2645',
  neptune: '\u2646',
  pluto: '\u2647',
  northNode: '\u260A',
  southNode: '\u260B',
  chiron: '\u26B7',
  ceres: '\u26B3',
  pallas: '\u26B4',
  juno: '\u26B5',
  vesta: '\u26B6',
};

/** Zodiac sign index 0 (Aries) through 11 (Pisces). */
export const SIGN_GLYPH: Record<number, string> = {
  0: '\u2648',
  1: '\u2649',
  2: '\u264A',
  3: '\u264B',
  4: '\u264C',
  5: '\u264D',
  6: '\u264E',
  7: '\u264F',
  8: '\u2650',
  9: '\u2651',
  10: '\u2652',
  11: '\u2653',
};

/** Visibility sanity: palette must read clearly on dark navy (bg ~#0C1320). */
export const WHEEL_COLORS = {
  outerRingStroke: '#4a5a7a',
  houseFill: '#1a2435',
  houseStroke: '#3d4f6e',
  houseNumberFill: '#64748B',
  planetGlyphFill: '#e8ecf1',
  planetGlyphFillDragging: '#ffd700',
  markerFill: '#e8ecf1',
  zodiacFillA: '#151B24',
  zodiacFillB: '#1A222E',
  zodiacGlyphFill: '#94A3B8',
  tickStroke: '#4a5a7a',
  cuspLabelFill: '#94A3B8',
  angleLabelFill: '#0e9696',
  glyphHaloStroke: '#0C1320',
} as const;

/** Bare symbol glyphs — avoids emoji presentation boxes on Windows. */
export const WHEEL_GLYPH_FONT =
  "'Segoe UI Symbol', 'Noto Sans Symbols', 'Arial Unicode MS', sans-serif";

export const WHEEL_GLYPH_HALO = {
  paintOrder: 'stroke fill' as const,
  stroke: WHEEL_COLORS.glyphHaloStroke,
  strokeWidth: 2.5,
  strokeLinejoin: 'round' as const,
};

export type WheelDisplayMode = 'technical' | 'simple';

/** Deterministic aspect line colors by type (conventional mapping). */
export const ASPECT_LINE_COLOR: Record<string, string> = {
  conjunction: '#b8a070',
  sextile: '#6b9bb8',
  square: '#c66b6b',
  trine: '#4a9b7a',
  opposition: '#9470b8',
};

export type WheelAspect = {
  bodyA?: string;
  bodyB?: string;
  a?: string;
  b?: string;
  type: string;
  orb?: number;
};
