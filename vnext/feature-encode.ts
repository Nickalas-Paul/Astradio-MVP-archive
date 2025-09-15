// vnext/feature-encode.ts
// Feature encoder using real Swiss Ephemeris snapshots (same path as prod)

import type { EphemerisSnapshot, FeatureVec } from "./contracts";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const normDeg = (d: number) => ((d % 360) + 360) % 360 / 360;

export function encodeFeatures(s: EphemerisSnapshot): FeatureVec {
  const f = new Float32Array(64);
  let i = 0;

  // Planets (0-9): sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto
  const order = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  for (const p of order) {
    f[i++] = normDeg(s.planets.find(x => x.name === p)?.lon ?? 0);
  }

  // House cusps (10-21)
  for (const cusp of s.houses) {
    f[i++] = normDeg(cusp);
  }

  // Aspect counts (22-26)
  const types = ['conjunction', 'sextile', 'square', 'trine', 'opposition'] as const;
  for (const t of types) {
    const c = s.aspects.filter(a => a.type === t).length;
    f[i++] = clamp01(c / 10);
  }

  // Elements (27-30)
  f[i++] = clamp01(s.dominantElements.fire);
  f[i++] = clamp01(s.dominantElements.earth);
  f[i++] = clamp01(s.dominantElements.air);
  f[i++] = clamp01(s.dominantElements.water);

  // Moon phase (31)
  f[i++] = clamp01(s.moonPhase);

  // Tension/cluster heuristics (32-33) - rules as features
  const squares = s.aspects.filter(a => a.type === 'square').length;
  const opps = s.aspects.filter(a => a.type === 'opposition').length;
  f[i++] = clamp01((squares * 0.6 + opps * 1.0) / 12); // tension
  f[i++] = clamp01(clusterDensity(s.planets)); // cluster density

  // Pad remaining features (34-63) with zeros for future expansion
  while (i < 64) {
    f[i++] = 0;
  }

  // Scrub NaN/Inf
  for (let j = 0; j < 64; j++) {
    if (!Number.isFinite(f[j])) {
      f[j] = 0;
    }
  }

  return f as FeatureVec;
}

function clusterDensity(planets: EphemerisSnapshot['planets']): number {
  const lons = planets.map(p => ((p.lon % 360) + 360) % 360).sort((a, b) => a - b);
  if (!lons.length) return 0;
  
  let maxGap = 0;
  for (let i = 0; i < lons.length; i++) {
    const a = lons[i];
    const b = lons[(i + 1) % lons.length] + (i + 1 === lons.length ? 360 : 0);
    maxGap = Math.max(maxGap, b - a);
  }
  return 1 - maxGap / 360; // higher = more clustered
}
