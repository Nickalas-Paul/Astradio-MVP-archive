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

/** Resolve planet color by body name (case-insensitive, alias-aware). */
export function planetColor(bodyKey: string): string | undefined {
  const key = normalizePlanetName(bodyKey);
  return PLANET_COLORS[key];
}
