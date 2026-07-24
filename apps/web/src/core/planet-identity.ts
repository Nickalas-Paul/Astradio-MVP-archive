export { PLANET_GLYPH } from '@/components/wheel/wheel-constants';

/** Muted jewel tones readable on dark backgrounds (bg-bg / bg-bgElev). */
export const PLANET_COLORS: Record<string, string> = {
  sun: '#E8C56D',
  moon: '#C4D4E8',
  mercury: '#A8D8CB',
  venus: '#D4A8C8',
  mars: '#D4836D',
  jupiter: '#8FAFD4',
  saturn: '#9B8FA4',
  uranus: '#6DC8C8',
  neptune: '#7B9FD4',
  pluto: '#A48B8B',
  chiron: '#B8C87B',
  northNode: '#8FC8A8',
  southNode: '#C8A88F',
  ascendant: '#E8D88F',
  mc: '#B8B8D4',
  ic: '#C8B8A0',
  ceres: '#9DC8A0',
  pallas: '#A8B8D4',
  juno: '#D4B8C8',
  vesta: '#C8C4A0',
};

export function normalizePlanetName(name: string): string {
  const lower = name.toLowerCase().trim();
  const aliases: Record<string, string> = {
    'north node': 'northNode',
    northnode: 'northNode',
    'south node': 'southNode',
    southnode: 'southNode',
    asc: 'ascendant',
    rising: 'ascendant',
    midheaven: 'mc',
    'imum coeli': 'ic',
  };
  return aliases[lower] ?? lower;
}

const ASPECT_TYPES = [
  'CONJUNCTION',
  'SEXTILE',
  'SQUARE',
  'TRINE',
  'OPPOSITION',
  'QUINCUNX',
  'SEMISEXTILE',
  'SEMISQUARE',
  'SESQUIQUADRATE',
  'QUINTILE',
  'BIQUINTILE',
] as const;

const KNOWN_PLANETS = [
  'PLUTO',
  'NEPTUNE',
  'URANUS',
  'SATURN',
  'JUPITER',
  'MARS',
  'VENUS',
  'MERCURY',
  'MOON',
  'SUN',
  'CHIRON',
  'CERES',
  'PALLAS',
  'JUNO',
  'VESTA',
  'NORTH_NODE',
  'SOUTH_NODE',
  'ASCENDANT',
  'MC',
  'IC',
] as const;

/** Parse aspect key format (e.g. "JUPITER_SUN_TRINE") into normalized planet names. */
export function parsePlanetNamesFromAspectKey(key: string): string[] {
  const parts = key.split('_');
  let typeIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (ASPECT_TYPES.includes(parts[i] as (typeof ASPECT_TYPES)[number])) {
      typeIndex = i;
      break;
    }
  }
  if (typeIndex < 0) return [];

  const planetPart = parts.slice(0, typeIndex).join('_');
  const multiWord = ['NORTH_NODE', 'SOUTH_NODE'] as const;
  for (const mw of multiWord) {
    if (planetPart.startsWith(`${mw}_`)) {
      return [normalizePlanetName(mw), normalizePlanetName(planetPart.slice(mw.length + 1))];
    }
    if (planetPart.endsWith(`_${mw}`)) {
      return [normalizePlanetName(planetPart.slice(0, -(mw.length + 1))), normalizePlanetName(mw)];
    }
  }

  for (const p of KNOWN_PLANETS) {
    if (planetPart.startsWith(`${p}_`)) {
      const remainder = planetPart.slice(p.length + 1);
      return [normalizePlanetName(p), normalizePlanetName(remainder)];
    }
  }
  return [];
}

export const SKY_SECTION_PLANETS: Record<string, string[]> = {
  todays_sound: ['moon', 'mercury', 'venus', 'mars'],
  sky_anchor: ['sun'],
  featured_transit: ['mercury', 'venus', 'mars'],
  emotional_weather: ['moon'],
};

export const IDENTITY_TIER_PLANETS: Record<string, string[]> = {
  core_identity: ['sun', 'moon', 'ascendant'],
  direction_foundation: ['mc', 'ic'],
  personal_expression: ['mercury', 'venus', 'mars'],
  growth_expansion: ['jupiter', 'saturn'],
  evolutionary_currents: ['uranus', 'neptune', 'pluto', 'chiron'],
};
