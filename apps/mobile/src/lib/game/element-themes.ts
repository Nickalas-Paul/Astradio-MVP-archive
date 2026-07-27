/**
 * Element-themed colors for Campaign character sheet (RN hex/rgba).
 */

export type ElementKey = 'fire' | 'earth' | 'air' | 'water';

export interface ElementTheme {
  element: ElementKey;
  /** Primary fill for mid/high combat stat bars. */
  statBarColor: string;
  /** High-percentile fill (>50%). */
  statBarHigh: string;
  /** Mid fill (25–50%). */
  statBarMid: string;
  /** Low fill (<25%). */
  statBarLow: string;
  statBarBg: string;
  badgeColor: string;
  badgeTextColor: string;
  badgeBorder: string;
}

const THEMES: Record<ElementKey, ElementTheme> = {
  fire: {
    element: 'fire',
    statBarColor: '#d4784a',
    statBarHigh: '#e8956a',
    statBarMid: '#d4a05e',
    statBarLow: '#d46b5a',
    statBarBg: 'rgba(255,255,255,0.1)',
    badgeColor: 'rgba(180,100,60,0.15)',
    badgeTextColor: 'rgba(220,160,100,0.95)',
    badgeBorder: 'rgba(220,140,80,0.25)',
  },
  earth: {
    element: 'earth',
    statBarColor: '#7c9a5e',
    statBarHigh: '#9bb87a',
    statBarMid: '#d4b95e',
    statBarLow: '#d46b5a',
    statBarBg: 'rgba(255,255,255,0.1)',
    badgeColor: 'rgba(139,115,85,0.15)',
    badgeTextColor: 'rgba(200,180,140,0.95)',
    badgeBorder: 'rgba(180,160,120,0.25)',
  },
  air: {
    element: 'air',
    statBarColor: '#a0b0c8',
    statBarHigh: '#c0d0e0',
    statBarMid: '#a0b0c8',
    statBarLow: '#d46b5a',
    statBarBg: 'rgba(255,255,255,0.1)',
    badgeColor: 'rgba(160,176,200,0.12)',
    badgeTextColor: 'rgba(200,215,235,0.95)',
    badgeBorder: 'rgba(180,200,220,0.2)',
  },
  water: {
    element: 'water',
    statBarColor: '#4a8a9a',
    statBarHigh: '#6ab0c0',
    statBarMid: '#5a9aaa',
    statBarLow: '#d46b5a',
    statBarBg: 'rgba(255,255,255,0.1)',
    badgeColor: 'rgba(80,140,170,0.12)',
    badgeTextColor: 'rgba(140,200,220,0.95)',
    badgeBorder: 'rgba(100,180,200,0.2)',
  },
};

export function normalizeElementKey(input: string | null | undefined): ElementKey {
  const key = String(input || '')
    .trim()
    .toLowerCase();
  if (key === 'fire' || key === 'earth' || key === 'air' || key === 'water') return key;
  return 'fire';
}

export function getElementTheme(element: string | null | undefined): ElementTheme {
  return THEMES[normalizeElementKey(element)];
}

/** Stat bar fill for a 1–20 scale value. */
export function elementStatBarColor(theme: ElementTheme, value: number, max = 20): string {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)));
  if (pct > 0.5) return theme.statBarHigh;
  if (pct > 0.25) return theme.statBarMid;
  return theme.statBarLow;
}
