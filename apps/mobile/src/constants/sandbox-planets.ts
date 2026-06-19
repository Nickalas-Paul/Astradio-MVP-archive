/** Planet order/labels aligned with web DegreePanel (core bodies). */
export const SANDBOX_PLANET_ORDER = [
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
  'chiron',
  'ceres',
  'pallas',
  'juno',
  'vesta',
] as const;

export type SandboxPlanetKey = (typeof SANDBOX_PLANET_ORDER)[number] | 'northNode';

export const SANDBOX_PLANET_LABELS: Record<string, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
  northNode: 'North Node',
  chiron: 'Chiron',
  ceres: 'Ceres',
  pallas: 'Pallas',
  juno: 'Juno',
  vesta: 'Vesta',
};

export const BODY_DISPLAY_ORDER = SANDBOX_PLANET_ORDER;
export const BODY_LABELS = SANDBOX_PLANET_LABELS;
