/**
 * AstroProfile compiler: builds structured astro facts from EphemerisSnapshot only.
 * Explainer-only; does not change snapshot or encoder.
 * Deterministic: no Date.now / Math.random.
 */

import type { EphemerisSnapshot } from '../contracts';

export type PlanetName = string; // Capitalized e.g. "Sun", "Moon"
export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
] as const;

const SIGN_TO_ELEMENT: Record<string, 'fire' | 'earth' | 'air' | 'water'> = {
  Aries: 'fire', Taurus: 'earth', Gemini: 'air', Cancer: 'water',
  Leo: 'fire', Virgo: 'earth', Libra: 'air', Scorpio: 'water',
  Sagittarius: 'fire', Capricorn: 'earth', Aquarius: 'air', Pisces: 'water'
};

const SIGN_TO_MODALITY: Record<string, 'cardinal' | 'fixed' | 'mutable'> = {
  Aries: 'cardinal', Taurus: 'fixed', Gemini: 'mutable', Cancer: 'cardinal',
  Leo: 'fixed', Virgo: 'mutable', Libra: 'cardinal', Scorpio: 'fixed',
  Sagittarius: 'mutable', Capricorn: 'cardinal', Aquarius: 'fixed', Pisces: 'mutable'
};

const PLANET_ORDER = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function normLon(lon: number): number {
  let x = lon % 360;
  if (x < 0) x += 360;
  return x;
}

/** Longitude to sign name and degree within sign (0–29.9). */
export function lonToSign(lon: number): { sign: string; degInSign: number } {
  const x = normLon(lon);
  const signIdx = Math.floor(x / 30) % 12;
  const degInSign = Math.round((x % 30) * 10) / 10;
  return { sign: ZODIAC_SIGNS[signIdx], degInSign };
}

/** Which house (1–12) contains this longitude given Placidus cusps. Wrap-safe. */
export function lonToHouse(lon: number, cusps: number[]): number {
  if (!cusps || cusps.length < 12) return 1;
  const x = normLon(lon);
  for (let i = 0; i < 12; i++) {
    const cStart = normLon(cusps[i]);
    const cEnd = normLon(cusps[(i + 1) % 12]);
    const inSegment =
      cStart <= cEnd
        ? x >= cStart && x < cEnd
        : x >= cStart || x < cEnd;
    if (inSegment) return i + 1;
  }
  return 1;
}

/** Angular distance (0–180). */
function angularDist(a: number, b: number): number {
  let d = Math.abs(normLon(a) - normLon(b));
  if (d > 180) d = 360 - d;
  return d;
}

/** If planet lon is within 8° of any angle, return that angle label. */
function nearAngle(
  lon: number,
  angleLons: { ASC: number; MC: number; IC: number; DSC: number }
): 'ASC' | 'MC' | 'IC' | 'DSC' | null {
  const d = 8;
  if (angularDist(lon, angleLons.ASC) <= d) return 'ASC';
  if (angularDist(lon, angleLons.MC) <= d) return 'MC';
  if (angularDist(lon, angleLons.IC) <= d) return 'IC';
  if (angularDist(lon, angleLons.DSC) <= d) return 'DSC';
  return null;
}

/** Orb to tightness: tight <= 2°, med <= 5°, wide > 5°. */
export function orbToTightness(orb: number): 'tight' | 'med' | 'wide' {
  if (orb <= 2) return 'tight';
  if (orb <= 5) return 'med';
  return 'wide';
}

export type AstroProfile = {
  ts: string;
  planets: Array<{
    name: PlanetName;
    lon: number;
    sign: string;
    degInSign: number;
    house: number;
    nearAngle: 'ASC' | 'MC' | 'IC' | 'DSC' | null;
  }>;
  angles: {
    ASC: { lon: number; sign: string };
    MC: { lon: number; sign: string };
    IC: { lon: number; sign: string };
    DSC: { lon: number; sign: string };
  };
  aspects: Array<{
    a: PlanetName;
    b: PlanetName;
    type: AspectType;
    orb: number;
    exactDeg?: number;
    tightness: 'tight' | 'med' | 'wide';
  }>;
  emphasis: {
    elementsBySign: { fire: number; earth: number; air: number; water: number };
    modalitiesBySign: { cardinal: number; fixed: number; mutable: number };
    hemisphereBias?: 'east' | 'west' | 'balanced';
    quadrantBias?: '1' | '2' | '3' | '4' | 'balanced';
  };
};

/**
 * Build AstroProfile from EphemerisSnapshot only. Deterministic.
 */
export function buildAstroProfile(snapshot: EphemerisSnapshot): AstroProfile {
  const cusps = snapshot.houses ?? Array.from({ length: 12 }, (_, i) => i * 30);
  const angleLons = {
    ASC: normLon(cusps[0]),
    MC: normLon(cusps[9]),
    IC: normLon(cusps[3]),
    DSC: normLon(cusps[6])
  };

  const planets = (snapshot.planets ?? [])
    .filter((p) => PLANET_ORDER.includes(p.name))
    .map((p) => {
      const lon = normLon(p.lon);
      const { sign, degInSign } = lonToSign(lon);
      const house = lonToHouse(lon, cusps);
      return {
        name: cap(p.name) as PlanetName,
        lon,
        sign,
        degInSign,
        house,
        nearAngle: nearAngle(lon, angleLons)
      };
    });

  const angles = {
    ASC: { lon: angleLons.ASC, ...lonToSign(angleLons.ASC) },
    MC: { lon: angleLons.MC, ...lonToSign(angleLons.MC) },
    IC: { lon: angleLons.IC, ...lonToSign(angleLons.IC) },
    DSC: { lon: angleLons.DSC, ...lonToSign(angleLons.DSC) }
  };

  const lonByPlanet: Record<string, number> = {};
  for (const p of planets) lonByPlanet[p.name.toLowerCase()] = p.lon;

  const aspects = (snapshot.aspects ?? []).map((asp) => {
    const bodyA = asp.bodyA ?? (asp as { a?: string }).a ?? '';
    const bodyB = asp.bodyB ?? (asp as { b?: string }).b ?? '';
    const orb = typeof asp.orb === 'number' ? asp.orb : 0;
    const lonA = lonByPlanet[bodyA] ?? 0;
    const lonB = lonByPlanet[bodyB] ?? 0;
    let exactDeg: number | undefined;
    if (lonByPlanet[bodyA] != null && lonByPlanet[bodyB] != null) {
      exactDeg = angularDist(lonA, lonB);
    }
    return {
      a: cap(bodyA) as PlanetName,
      b: cap(bodyB) as PlanetName,
      type: asp.type as AspectType,
      orb,
      exactDeg,
      tightness: orbToTightness(orb)
    };
  });

  const elementCounts = { fire: 0, earth: 0, air: 0, water: 0 };
  const modalityCounts = { cardinal: 0, fixed: 0, mutable: 0 };
  for (const p of planets) {
    const el = SIGN_TO_ELEMENT[p.sign];
    const mod = SIGN_TO_MODALITY[p.sign];
    if (el) elementCounts[el]++;
    if (mod) modalityCounts[mod]++;
  }
  const elSum = elementCounts.fire + elementCounts.earth + elementCounts.air + elementCounts.water || 1;
  const modSum = modalityCounts.cardinal + modalityCounts.fixed + modalityCounts.mutable || 1;
  const elementsBySign = {
    fire: elementCounts.fire / elSum,
    earth: elementCounts.earth / elSum,
    air: elementCounts.air / elSum,
    water: elementCounts.water / elSum
  };
  const modalitiesBySign = {
    cardinal: modalityCounts.cardinal / modSum,
    fixed: modalityCounts.fixed / modSum,
    mutable: modalityCounts.mutable / modSum
  };

  let hemisphereBias: 'east' | 'west' | 'balanced' | undefined;
  const east = planets.filter((p) => p.house >= 1 && p.house <= 6).length;
  const west = planets.filter((p) => p.house >= 7 && p.house <= 12).length;
  if (east > west + 1) hemisphereBias = 'east';
  else if (west > east + 1) hemisphereBias = 'west';
  else hemisphereBias = 'balanced';

  const q1 = planets.filter((p) => p.house >= 1 && p.house <= 3).length;
  const q2 = planets.filter((p) => p.house >= 4 && p.house <= 6).length;
  const q3 = planets.filter((p) => p.house >= 7 && p.house <= 9).length;
  const q4 = planets.filter((p) => p.house >= 10 && p.house <= 12).length;
  const qMax = Math.max(q1, q2, q3, q4);
  let quadrantBias: '1' | '2' | '3' | '4' | 'balanced' | undefined;
  if (qMax <= 1) quadrantBias = 'balanced';
  else if (q1 === qMax) quadrantBias = '1';
  else if (q2 === qMax) quadrantBias = '2';
  else if (q3 === qMax) quadrantBias = '3';
  else if (q4 === qMax) quadrantBias = '4';
  else quadrantBias = 'balanced';

  return {
    ts: snapshot.ts ?? '',
    planets,
    angles,
    aspects,
    emphasis: {
      elementsBySign,
      modalitiesBySign,
      hemisphereBias,
      quadrantBias
    }
  };
}
