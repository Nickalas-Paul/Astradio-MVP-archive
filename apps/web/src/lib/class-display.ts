/**
 * Client-side fantasy class display mapping for the Campaign surface.
 * Sign → fantasy class name, element, modality, and role description.
 * Presentation-only; slugs and mechanics are untouched.
 */

export type GameElement = 'Fire' | 'Earth' | 'Air' | 'Water';
export type GameModality = 'Cardinal' | 'Fixed' | 'Mutable';

export interface ClassInfo {
  name: string;
  element: GameElement;
  modality: GameModality;
  role: string;
}

export const CLASS_MAP: Readonly<Record<string, ClassInfo>> = {
  aries: {
    name: 'Flamecaller',
    element: 'Fire',
    modality: 'Cardinal',
    role: 'Aggressive striker, initiator',
  },
  taurus: {
    name: 'Stonebinder',
    element: 'Earth',
    modality: 'Fixed',
    role: 'Resilient tank, resource hoarder',
  },
  gemini: {
    name: 'Spelltwister',
    element: 'Air',
    modality: 'Mutable',
    role: 'Fast dual-caster, chaos manipulator',
  },
  cancer: {
    name: 'Tidemage',
    element: 'Water',
    modality: 'Cardinal',
    role: 'Protective healer, emotion-based power',
  },
  leo: {
    name: 'Radiant',
    element: 'Fire',
    modality: 'Fixed',
    role: 'Charismatic leader, self-buffing paladin',
  },
  virgo: {
    name: 'Mindweaver',
    element: 'Earth',
    modality: 'Mutable',
    role: 'Tactical debuffer, precision magic',
  },
  libra: {
    name: 'Mirrorblade',
    element: 'Air',
    modality: 'Cardinal',
    role: 'Balanced duelist, charm-based fighter',
  },
  scorpio: {
    name: 'Soulpiercer',
    element: 'Water',
    modality: 'Fixed',
    role: 'Shadow assassin, emotional control',
  },
  sagittarius: {
    name: 'Starforger',
    element: 'Fire',
    modality: 'Mutable',
    role: 'Long-range chaos archer, travel-based skills',
  },
  capricorn: {
    name: 'Ironwright',
    element: 'Earth',
    modality: 'Cardinal',
    role: 'Fortress builder, enduring strategist',
  },
  aquarius: {
    name: 'Stormsinger',
    element: 'Air',
    modality: 'Fixed',
    role: 'Inventive spellcaster, anti-structure',
  },
  pisces: {
    name: 'Dreamdancer',
    element: 'Water',
    modality: 'Mutable',
    role: 'Illusionist, dreamwalker, spiritual buffer',
  },
};

/** Normalize `class_taurus` / `subclass_taurus` / `rising_taurus` / `Taurus` → `taurus`. */
export function normalizeSignSlug(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/^(class_|subclass_|rising_)/, '')
    .trim();
}

export function classInfoForSign(sign: string): ClassInfo | null {
  return CLASS_MAP[normalizeSignSlug(sign)] ?? null;
}

export interface ClassDisplay {
  className: string;
  subclassName: string;
  risingName: string;
  classInitial: string;
  element: GameElement;
  modality: GameModality;
  role: string;
  sunSign: string;
  moonSign: string;
  ascSign: string;
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function getClassDisplay(
  sunSign: string,
  moonSign: string,
  ascSign: string
): ClassDisplay {
  const sun = normalizeSignSlug(sunSign);
  const moon = normalizeSignSlug(moonSign);
  const asc = normalizeSignSlug(ascSign);

  const sunInfo = CLASS_MAP[sun];
  const moonInfo = CLASS_MAP[moon];
  const ascInfo = CLASS_MAP[asc];

  const className = sunInfo?.name ?? titleCase(sun) ?? 'Wanderer';
  return {
    className,
    subclassName: moonInfo?.name ?? titleCase(moon) ?? 'Unknown',
    risingName: ascInfo?.name ?? titleCase(asc) ?? 'Unknown',
    classInitial: className.slice(0, 2).toUpperCase(),
    element: sunInfo?.element ?? 'Earth',
    modality: sunInfo?.modality ?? 'Fixed',
    role: sunInfo?.role ?? 'Adventurer',
    sunSign: titleCase(sun),
    moonSign: titleCase(moon),
    ascSign: titleCase(asc),
  };
}

export interface ElementColors {
  gradient1: string;
  gradient2: string;
  glowColor: string;
  orbColor: string;
}

const ELEMENT_COLORS: Record<GameElement, ElementColors> = {
  Earth: {
    gradient1: '#0e9696',
    gradient2: '#00674f',
    glowColor: 'rgba(14,150,150,.12)',
    orbColor: 'rgba(107,114,128,.06)',
  },
  Fire: {
    gradient1: '#EF4444',
    gradient2: '#991B1B',
    glowColor: 'rgba(239,68,68,.1)',
    orbColor: 'rgba(245,158,11,.06)',
  },
  Water: {
    gradient1: '#3B82F6',
    gradient2: '#1E40AF',
    glowColor: 'rgba(59,130,246,.1)',
    orbColor: 'rgba(139,92,246,.06)',
  },
  Air: {
    gradient1: '#94A3B8',
    gradient2: '#475569',
    glowColor: 'rgba(148,163,184,.1)',
    orbColor: 'rgba(14,150,150,.06)',
  },
};

export function getElementColors(element: string): ElementColors {
  const key = (titleCase(String(element || '').toLowerCase()) as GameElement) || 'Earth';
  return ELEMENT_COLORS[key] ?? ELEMENT_COLORS.Earth;
}
