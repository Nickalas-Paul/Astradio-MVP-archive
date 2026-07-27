export type ElementKey = 'fire' | 'earth' | 'air' | 'water';

export type ElementTheme = {
  element: ElementKey;
  statBarHigh: string;
  statBarMid: string;
  statBarLow: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
};

export const ELEMENT_THEMES: Record<ElementKey, ElementTheme> = {
  earth: {
    element: 'earth',
    statBarHigh: 'linear-gradient(90deg, #7c9a5e, #9bb87a)',
    statBarMid: 'linear-gradient(90deg, #c9a84c, #d4b95e)',
    statBarLow: 'linear-gradient(90deg, #c25a4a, #d46b5a)',
    badgeBg: 'rgba(139,115,85,0.1)',
    badgeBorder: 'rgba(180,160,120,0.15)',
    textColor: 'rgba(200,180,140,0.9)',
  },
  fire: {
    element: 'fire',
    statBarHigh: 'linear-gradient(90deg, #d4784a, #e8956a)',
    statBarMid: 'linear-gradient(90deg, #c9844c, #d4a05e)',
    statBarLow: 'linear-gradient(90deg, #c25a4a, #d46b5a)',
    badgeBg: 'rgba(180,100,60,0.1)',
    badgeBorder: 'rgba(220,140,80,0.15)',
    textColor: 'rgba(220,160,100,0.9)',
  },
  air: {
    element: 'air',
    statBarHigh: 'linear-gradient(90deg, #a0b0c8, #c0d0e0)',
    statBarMid: 'linear-gradient(90deg, #8898b0, #a0b0c8)',
    statBarLow: 'linear-gradient(90deg, #c25a4a, #d46b5a)',
    badgeBg: 'rgba(160,176,200,0.08)',
    badgeBorder: 'rgba(180,200,220,0.12)',
    textColor: 'rgba(200,215,235,0.9)',
  },
  water: {
    element: 'water',
    statBarHigh: 'linear-gradient(90deg, #4a8a9a, #6ab0c0)',
    statBarMid: 'linear-gradient(90deg, #4a7a8a, #5a9aaa)',
    statBarLow: 'linear-gradient(90deg, #c25a4a, #d46b5a)',
    badgeBg: 'rgba(80,140,170,0.08)',
    badgeBorder: 'rgba(100,180,200,0.12)',
    textColor: 'rgba(140,200,220,0.9)',
  },
};

export function normalizeElementKey(input: string | null | undefined): ElementKey {
  const key = String(input || '')
    .trim()
    .toLowerCase();
  if (key === 'fire' || key === 'earth' || key === 'air' || key === 'water') return key;
  return 'earth';
}

export function getElementTheme(input: string | null | undefined): ElementTheme {
  return ELEMENT_THEMES[normalizeElementKey(input)];
}

/** Stat bar fill for a 1–20 scale value. */
export function elementStatBarGradient(theme: ElementTheme, value: number, max = 20): string {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)));
  if (pct > 0.5) return theme.statBarHigh;
  if (pct > 0.25) return theme.statBarMid;
  return theme.statBarLow;
}
