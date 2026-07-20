import { normalizePlanetName, PLANET_COLORS } from '../../../core/planet-identity';
import type { AuraRawSnapshot } from '../aura-raw-snapshot';
import { ASPECT_LINE_COLOR, WHEEL_COLORS } from '../wheel-constants';
import type {
  HarmonicAspectArc,
  HarmonicElement,
  HarmonicPalette,
  HarmonicPlanetSource,
} from './types';

export const HARMONIC_DISK_RADIUS = 3.2;
export const MAX_WAVE_SOURCES = 10;
export const SELECTED_AMPLITUDE_MULTIPLIER = 2.2;
export const MUTED_AMPLITUDE_MULTIPLIER = 0.05;

const BODY_FREQUENCY: Record<string, number> = {
  moon: 8,
  mercury: 6.8,
  venus: 5.6,
  sun: 5.2,
  mars: 4.4,
  jupiter: 2.8,
  saturn: 2.2,
  uranus: 1.6,
  neptune: 1.5,
  pluto: 1.5,
};

const SIGN_ELEMENTS: HarmonicElement[] = [
  'fire',
  'earth',
  'air',
  'water',
  'fire',
  'earth',
  'air',
  'water',
  'fire',
  'earth',
  'air',
  'water',
];

// Terrain-only colors. Planet and aspect colors always come from shared repo tokens.
const TERRAIN_PALETTE = {
  deepPurple: '#1b1026',
  roseAmber: '#b75f43',
  amber: '#d58a36',
  gold: '#e8c56d',
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

export function planetElement(longitude: number): HarmonicElement {
  const signIndex = Math.floor(normalizeDegrees(longitude) / 30) % 12;
  return SIGN_ELEMENTS[signIndex] ?? 'earth';
}

export function planetFrequency(name: string, speed?: number): number {
  const key = normalizePlanetName(name);
  const fallback = BODY_FREQUENCY[key] ?? 1.5;
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed === 0) return fallback;

  // The ephemeris speed range is highly skewed. Log compression preserves the
  // Moon-to-outer-planet ordering without letting retrogrades produce spikes.
  const speedMagnitude = Math.abs(speed);
  const normalized = clamp(Math.log1p(speedMagnitude) / Math.log1p(14), 0, 1);
  return clamp(1.5 + normalized * 6.5, 1.5, 8);
}

export function planetAmplitude(name: string): number {
  const key = normalizePlanetName(name);
  if (key === 'sun' || key === 'moon') return 1;
  if (key === 'mercury' || key === 'venus' || key === 'mars') return 0.75;
  if (key === 'jupiter' || key === 'saturn') return 0.55;
  return 0.4;
}

export function planetMarkerSize(name: string): number {
  const key = normalizePlanetName(name);
  if (key === 'sun') return 0.2;
  if (key === 'moon') return 0.15;
  return 0.09;
}

export function isolationMultiplier(sourceIndex: number, highlightIndex: number): number {
  if (highlightIndex < 0) return 1;
  return sourceIndex === highlightIndex
    ? SELECTED_AMPLITUDE_MULTIPLIER
    : MUTED_AMPLITUDE_MULTIPLIER;
}

export function resolvePlanetColor(name: string): string {
  return PLANET_COLORS[normalizePlanetName(name)] ?? WHEEL_COLORS.planetGlyphFill;
}

export function resolveAspectColor(type: string): string {
  return ASPECT_LINE_COLOR[type.trim().toLowerCase()] ?? WHEEL_COLORS.outerRingStroke;
}

export function elementWarmth(elements: AuraRawSnapshot['dominantElements']): number {
  const total = elements.fire + elements.earth + elements.air + elements.water;
  if (!Number.isFinite(total) || total <= 0) return 0.5;
  const fire = elements.fire / total;
  const water = elements.water / total;
  const earth = elements.earth / total;
  // Always warm: fire pushes amber/gold; water adds restrained rose undertones.
  return clamp(0.45 + fire * 0.35 + earth * 0.1 - water * 0.08, 0.35, 0.85);
}

export function terrainPalette(
  elements: AuraRawSnapshot['dominantElements'],
): HarmonicPalette {
  const warmth = elementWarmth(elements);
  return {
    warmth,
    baseColorA: TERRAIN_PALETTE.deepPurple,
    baseColorB: warmth >= 0.58 ? TERRAIN_PALETTE.gold : TERRAIN_PALETTE.roseAmber,
  };
}

export function mapPlanetSources(
  planets: AuraRawSnapshot['planets'],
): HarmonicPlanetSource[] {
  return planets.slice(0, MAX_WAVE_SOURCES).map((planet, index) => {
    const lon = normalizeDegrees(planet.lon);
    const theta = (lon * Math.PI) / 180;
    return {
      key: normalizePlanetName(planet.name),
      name: planet.name,
      index,
      lon,
      theta,
      position: [
        Math.cos(theta) * HARMONIC_DISK_RADIUS,
        Math.sin(theta) * HARMONIC_DISK_RADIUS,
      ],
      frequency: planetFrequency(planet.name, planet.speed),
      amplitude: planetAmplitude(planet.name),
      color: resolvePlanetColor(planet.name),
      element: planetElement(lon),
      markerSize: planetMarkerSize(planet.name),
    };
  });
}

function circularMidpointAngle(a: number, b: number): number {
  const x = Math.cos(a) + Math.cos(b);
  const y = Math.sin(a) + Math.sin(b);
  return Math.atan2(y, x);
}

export function mapAspectArcs(
  aspects: AuraRawSnapshot['aspects'],
  sources: HarmonicPlanetSource[],
): HarmonicAspectArc[] {
  const indexByName = new Map(sources.map((source) => [source.key, source.index]));
  return aspects.flatMap((aspect, aspectIndex) => {
    const fromIdx = indexByName.get(normalizePlanetName(aspect.bodies[0]));
    const toIdx = indexByName.get(normalizePlanetName(aspect.bodies[1]));
    if (fromIdx === undefined || toIdx === undefined || fromIdx === toIdx) return [];

    const from = sources[fromIdx];
    const to = sources[toIdx];
    if (!from || !to) return [];

    const strength =
      typeof aspect.strength === 'number'
        ? clamp(aspect.strength, 0, 1)
        : clamp(1 - Math.abs(aspect.orb) / 10, 0.15, 1);
    const type = aspect.type.trim().toLowerCase();
    return [{
      key: `${from.key}-${to.key}-${type}-${aspectIndex}`,
      type,
      fromIdx,
      toIdx,
      midpointAngle: circularMidpointAngle(from.theta, to.theta),
      influence: 0.08 + strength * 0.12,
      color: resolveAspectColor(type),
      opacity: 0.2 + strength * 0.5,
    }];
  });
}
