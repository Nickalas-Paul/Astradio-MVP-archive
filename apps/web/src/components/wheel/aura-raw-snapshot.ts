/** Raw ephemeris snapshot for Aura modal visualization. */
export type AuraRawSnapshot = {
  planets: Array<{ name: string; lon: number; lat?: number; speed?: number }>;
  aspects: Array<{
    bodies: [string, string];
    type: string;
    orb: number;
    strength?: number;
    exactness?: number;
    dynamics?: string;
  }>;
  /** 12 house cusps in degrees (unused in Harmonic v1; threaded for later). */
  houses?: number[];
  dominantElements: { fire: number; earth: number; air: number; water: number };
  moonPhase: number;
};

export function dominantElementLabel(
  elements: AuraRawSnapshot['dominantElements'],
): keyof AuraRawSnapshot['dominantElements'] {
  const entries = Object.entries(elements) as [
    keyof AuraRawSnapshot['dominantElements'],
    number,
  ][];
  return entries.reduce((best, [key, value]) => (value > best[1] ? [key, value] : best), entries[0]!)[0];
}

export function extractAuraRawSnapshot(payload: unknown): AuraRawSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  if (!Array.isArray(obj.planets)) return null;

  const planets: AuraRawSnapshot['planets'] = [];
  for (const entry of obj.planets) {
    if (!entry || typeof entry !== 'object') continue;
    const planet = entry as { name?: string; lon?: number; lat?: number; speed?: number };
    if (typeof planet.name !== 'string' || typeof planet.lon !== 'number' || !Number.isFinite(planet.lon)) {
      continue;
    }
    planets.push({
      name: planet.name,
      lon: planet.lon,
      ...(typeof planet.lat === 'number' && Number.isFinite(planet.lat) ? { lat: planet.lat } : {}),
      ...(typeof planet.speed === 'number' && Number.isFinite(planet.speed) ? { speed: planet.speed } : {}),
    });
  }
  if (planets.length === 0) return null;

  const aspects: AuraRawSnapshot['aspects'] = [];
  if (Array.isArray(obj.aspects)) {
    for (const entry of obj.aspects) {
      if (!entry || typeof entry !== 'object') continue;
      const asp = entry as Record<string, unknown>;
      let bodies: [string, string] | null = null;
      if (Array.isArray(asp.bodies) && asp.bodies.length >= 2) {
        bodies = [String(asp.bodies[0]), String(asp.bodies[1])];
      } else {
        const bodyA = asp.bodyA ?? asp.a;
        const bodyB = asp.bodyB ?? asp.b;
        if (typeof bodyA === 'string' && typeof bodyB === 'string') {
          bodies = [bodyA, bodyB];
        }
      }
      if (
        !bodies ||
        typeof asp.type !== 'string' ||
        typeof asp.orb !== 'number' ||
        !Number.isFinite(asp.orb)
      ) {
        continue;
      }
      aspects.push({
        bodies,
        type: asp.type,
        orb: asp.orb,
        ...(typeof asp.strength === 'number' && Number.isFinite(asp.strength)
          ? { strength: asp.strength }
          : {}),
        ...(typeof asp.exactness === 'number' && Number.isFinite(asp.exactness)
          ? { exactness: asp.exactness }
          : {}),
        ...(typeof asp.dynamics === 'string' ? { dynamics: asp.dynamics } : {}),
      });
    }
  }

  const de = obj.dominantElements;
  if (!de || typeof de !== 'object') return null;
  const dominant = de as Record<string, unknown>;
  const fire = dominant.fire;
  const earth = dominant.earth;
  const air = dominant.air;
  const water = dominant.water;
  if (
    typeof fire !== 'number' ||
    typeof earth !== 'number' ||
    typeof air !== 'number' ||
    typeof water !== 'number' ||
    !Number.isFinite(fire) ||
    !Number.isFinite(earth) ||
    !Number.isFinite(air) ||
    !Number.isFinite(water)
  ) {
    return null;
  }

  const moonPhase = obj.moonPhase;
  if (typeof moonPhase !== 'number' || !Number.isFinite(moonPhase)) return null;

  let houses: number[] | undefined;
  const rawHouses = obj.houses ?? obj.houseCusps ?? obj.cusps;
  if (Array.isArray(rawHouses) && rawHouses.length >= 12) {
    const parsed = rawHouses.slice(0, 12).map((value) => Number(value));
    if (parsed.every((value) => Number.isFinite(value))) {
      houses = parsed;
    }
  }

  return {
    planets,
    aspects,
    ...(houses ? { houses } : {}),
    dominantElements: { fire, earth, air, water },
    moonPhase,
  };
}
