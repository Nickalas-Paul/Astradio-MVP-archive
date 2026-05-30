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

/** Visibility sanity: palette must read clearly on dark navy (bg ~#0C1320). */
export const WHEEL_COLORS = {
  outerRingStroke: '#4a5a7a',
  houseFill: '#1a2435',
  houseStroke: '#3d4f6e',
  houseNumberFill: '#b8c5d6',
  planetGlyphFill: '#e8ecf1',
  planetGlyphFillDragging: '#ffd700',
  markerFill: '#e8ecf1',
} as const;

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
