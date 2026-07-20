import { ASPECT_LINE_COLOR, ZODIAC_SIGNS } from '../../constants/wheel-constants';
import { normalizePlanetName, PLANET_COLORS } from '../../constants/planet-colors';
import type { EphemerisSnapshot, SnapshotAspect, SnapshotPlanet } from '../../types/my-sky';

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

const BODY_DISPLAY: Record<string, string> = {
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
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

export type HarmonicPlanetSource = {
  key: string;
  label: string;
  index: number;
  lon: number;
  /** Angle for drawing (0° Aries at +X, matching web disk). */
  theta: number;
  frequency: number;
  amplitude: number;
  color: string;
  sign: string;
  degreeInSign: number;
  voice: string;
};

export type HarmonicAspectArc = {
  key: string;
  type: string;
  fromIdx: number;
  toIdx: number;
  color: string;
};

function planetFrequency(name: string, speed?: number): number {
  const key = normalizePlanetName(name);
  const fallback = BODY_FREQUENCY[key] ?? 1.5;
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed === 0) return fallback;
  const normalized = clamp(Math.log1p(Math.abs(speed)) / Math.log1p(14), 0, 1);
  return clamp(1.5 + normalized * 6.5, 1.5, 8);
}

function planetAmplitude(name: string): number {
  const key = normalizePlanetName(name);
  if (key === 'sun' || key === 'moon') return 1;
  if (key === 'mercury' || key === 'venus' || key === 'mars') return 0.75;
  if (key === 'jupiter' || key === 'saturn') return 0.55;
  return 0.4;
}

function planetVoice(name: string): string {
  const key = normalizePlanetName(name);
  if (key === 'sun' || key === 'moon') return 'Lead voice';
  if (key === 'mercury' || key === 'venus' || key === 'mars') return 'Harmony voice';
  if (key === 'jupiter' || key === 'saturn') return 'Bass presence';
  return 'Atmospheric color';
}

function aspectBodies(aspect: SnapshotAspect): [string, string] | null {
  if (Array.isArray(aspect.bodies) && aspect.bodies.length >= 2) {
    return [String(aspect.bodies[0]), String(aspect.bodies[1])];
  }
  if (typeof aspect.bodyA === 'string' && typeof aspect.bodyB === 'string') {
    return [aspect.bodyA, aspect.bodyB];
  }
  if (typeof aspect.a === 'string' && typeof aspect.b === 'string') {
    return [aspect.a, aspect.b];
  }
  return null;
}

function collectPlanets(snapshot: EphemerisSnapshot): SnapshotPlanet[] {
  if (Array.isArray(snapshot.planets) && snapshot.planets.length > 0) {
    return snapshot.planets;
  }
  if (snapshot.positions) {
    return Object.entries(snapshot.positions).map(([name, lon]) => ({
      name,
      lon,
    }));
  }
  return [];
}

export function mapPlanetSources(snapshot: EphemerisSnapshot): HarmonicPlanetSource[] {
  const planets = collectPlanets(snapshot);
  const preferred = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  const byKey = new Map<string, SnapshotPlanet>();
  for (const planet of planets) {
    const key = normalizePlanetName(planet.name);
    if (!byKey.has(key) && typeof planet.lon === 'number' && Number.isFinite(planet.lon)) {
      byKey.set(key, planet);
    }
  }

  const ordered: SnapshotPlanet[] = [];
  for (const key of preferred) {
    const planet = byKey.get(key);
    if (planet) {
      ordered.push(planet);
      byKey.delete(key);
    }
  }
  for (const planet of byKey.values()) {
    if (ordered.length >= MAX_WAVE_SOURCES) break;
    ordered.push(planet);
  }

  return ordered.slice(0, MAX_WAVE_SOURCES).map((planet, index) => {
    const key = normalizePlanetName(planet.name);
    const lon = normalizeDegrees(planet.lon);
    const signIndex = Math.floor(lon / 30) % 12;
    return {
      key,
      label: BODY_DISPLAY[key] ?? planet.name,
      index,
      lon,
      theta: (lon * Math.PI) / 180,
      frequency: planetFrequency(planet.name, planet.speed),
      amplitude: planetAmplitude(planet.name),
      color: PLANET_COLORS[key] ?? '#E8C56D',
      sign: ZODIAC_SIGNS[signIndex] ?? 'Aries',
      degreeInSign: lon % 30,
      voice: planetVoice(planet.name),
    };
  });
}

export function mapAspectArcs(
  snapshot: EphemerisSnapshot,
  sources: HarmonicPlanetSource[],
): HarmonicAspectArc[] {
  const indexByName = new Map(sources.map((source) => [source.key, source.index]));
  const aspects = snapshot.aspects ?? [];
  return aspects.flatMap((aspect, aspectIndex) => {
    const bodies = aspectBodies(aspect);
    if (!bodies) return [];
    const fromIdx = indexByName.get(normalizePlanetName(bodies[0]));
    const toIdx = indexByName.get(normalizePlanetName(bodies[1]));
    if (fromIdx === undefined || toIdx === undefined || fromIdx === toIdx) return [];
    const type = aspect.type.trim().toLowerCase();
    return [
      {
        key: `${bodies[0]}-${bodies[1]}-${type}-${aspectIndex}`,
        type,
        fromIdx,
        toIdx,
        color: ASPECT_LINE_COLOR[type] ?? '#6a7a8a',
      },
    ];
  });
}

/** Normalized 0–1 canvas positions at 64% of disk radius (top-down view). */
export function planetCanvasPosition(
  source: HarmonicPlanetSource,
): { x: number; y: number } {
  const angle = source.theta - Math.PI / 2; // 0° Aries at top (screen-friendly)
  const r = 0.32; // 0.64 diameter / 2 in normalized coords from center
  return {
    x: 0.5 + Math.cos(angle) * r,
    y: 0.5 + Math.sin(angle) * r,
  };
}

function hexToRgb01(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const value = cleaned.length === 3
    ? cleaned.split('').map((ch) => ch + ch).join('')
    : cleaned;
  const num = Number.parseInt(value, 16);
  if (!Number.isFinite(num)) return [0.9, 0.77, 0.43];
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

export function buildShaderPlanetUniforms(sources: HarmonicPlanetSource[]): {
  positions: number[][];
  freqs: number[];
  amps: number[];
  colors: number[][];
} {
  const positions: number[][] = [];
  const freqs: number[] = [];
  const amps: number[] = [];
  const colors: number[][] = [];
  for (let i = 0; i < MAX_WAVE_SOURCES; i += 1) {
    const source = sources[i];
    if (!source) {
      positions.push([0.5, 0.5]);
      freqs.push(1.5);
      amps.push(0);
      colors.push([0, 0, 0]);
      continue;
    }
    const pos = planetCanvasPosition(source);
    positions.push([pos.x, pos.y]);
    freqs.push(source.frequency);
    amps.push(source.amplitude);
    colors.push(hexToRgb01(source.color));
  }
  return { positions, freqs, amps, colors };
}
