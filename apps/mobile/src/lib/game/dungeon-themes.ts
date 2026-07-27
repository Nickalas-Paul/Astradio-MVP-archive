/**
 * Campaign dungeon atmosphere tokens for React Native.
 * House 1–12 map; hex colors only (no CSS).
 */

export type DungeonTemperature = 'hot' | 'warm' | 'cool' | 'cold' | 'neutral';

export interface DungeonTheme {
  house: number;
  label: string;
  domain: string;
  /** LinearGradient colors (top → bottom). */
  gradient: [string, string];
  accent: string;
  accentMuted: string;
  textAccent: string;
  temperature: DungeonTemperature;
}

const THEMES: Record<number, DungeonTheme> = {
  1: {
    house: 1,
    label: 'The Identity Forge',
    domain: 'Self',
    gradient: ['#0C1320', '#2a1a12'],
    accent: '#DC8C3C',
    accentMuted: 'rgba(220,140,60,0.25)',
    textAccent: '#DCA050',
    temperature: 'hot',
  },
  2: {
    house: 2,
    label: 'The Vault of Worth',
    domain: 'Resources',
    gradient: ['#0C1320', '#24201a'],
    accent: '#C8AA50',
    accentMuted: 'rgba(200,170,80,0.25)',
    textAccent: '#D2B964',
    temperature: 'warm',
  },
  3: {
    house: 3,
    label: 'The Hall of Whispers',
    domain: 'Communication',
    gradient: ['#0C1320', '#1a2030'],
    accent: '#B4BED2',
    accentMuted: 'rgba(180,190,210,0.22)',
    textAccent: '#BEC8DC',
    temperature: 'cool',
  },
  4: {
    house: 4,
    label: 'The Ancestral Crypt',
    domain: 'Home',
    gradient: ['#0C1320', '#1e2418'],
    accent: '#A0B478',
    accentMuted: 'rgba(160,180,120,0.22)',
    textAccent: '#B4C88C',
    temperature: 'warm',
  },
  5: {
    house: 5,
    label: 'The Arena of Expression',
    domain: 'Creativity',
    gradient: ['#0C1320', '#2a1a20'],
    accent: '#DCA064',
    accentMuted: 'rgba(220,160,100,0.25)',
    textAccent: '#E6AF73',
    temperature: 'hot',
  },
  6: {
    house: 6,
    label: 'The Proving Grounds',
    domain: 'Service',
    gradient: ['#0C1320', '#14202a'],
    accent: '#8CAAC8',
    accentMuted: 'rgba(140,170,200,0.22)',
    textAccent: '#A0B9D7',
    temperature: 'cool',
  },
  7: {
    house: 7,
    label: 'The Relational Dungeon',
    domain: 'Partnership',
    gradient: ['#0C1320', '#1e1e2a'],
    accent: '#B4AAC8',
    accentMuted: 'rgba(180,170,200,0.22)',
    textAccent: '#C3B9D7',
    temperature: 'neutral',
  },
  8: {
    house: 8,
    label: 'The Underworld Gate',
    domain: 'Transformation',
    gradient: ['#0C1320', '#1e1428'],
    accent: '#A078DC',
    accentMuted: 'rgba(160,120,220,0.25)',
    textAccent: '#B491EB',
    temperature: 'cold',
  },
  9: {
    house: 9,
    label: "The Pilgrim's Ascent",
    domain: 'Philosophy',
    gradient: ['#0C1320', '#1a2a52'],
    accent: '#78A0FF',
    accentMuted: 'rgba(120,160,255,0.25)',
    textAccent: '#A0B4F0',
    temperature: 'cool',
  },
  10: {
    house: 10,
    label: 'The Summit Tribunal',
    domain: 'Legacy',
    gradient: ['#0C1320', '#141a24'],
    accent: '#B4AA82',
    accentMuted: 'rgba(180,170,130,0.25)',
    textAccent: '#C8BE96',
    temperature: 'cold',
  },
  11: {
    house: 11,
    label: 'The Network Labyrinth',
    domain: 'Community',
    gradient: ['#0C1320', '#142028'],
    accent: '#50C8C8',
    accentMuted: 'rgba(80,200,200,0.25)',
    textAccent: '#64D7D7',
    temperature: 'cool',
  },
  12: {
    house: 12,
    label: 'The Dream Vault',
    domain: 'Unconscious',
    gradient: ['#0C1320', '#141e38'],
    accent: '#648CDC',
    accentMuted: 'rgba(100,140,220,0.25)',
    textAccent: '#82A5EB',
    temperature: 'cold',
  },
};

export function getDungeonTheme(house: number | null | undefined): DungeonTheme {
  const h = typeof house === 'number' && house >= 1 && house <= 12 ? house : 1;
  return THEMES[h] ?? THEMES[1]!;
}
