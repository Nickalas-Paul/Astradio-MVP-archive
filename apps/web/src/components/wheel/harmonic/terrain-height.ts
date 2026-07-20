/** CPU mirror of terrainVertexShader displacement — keep in sync with terrainShader.ts */

export const TERRAIN_GLOBAL_DAMPING = 0.34;
export const TERRAIN_DISPLACEMENT_SCALE = 0.48;
export const PLANET_SURFACE_OFFSET = 0.15;

export type TerrainWaveSource = {
  x: number;
  z: number;
  frequency: number;
  amplitude: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** GLSL smoothstep with inverted edges (4.9 → 4.2) for circular disk mask. */
function diskMask(radius: number): number {
  const t = clamp01((radius - 4.9) / (4.2 - 4.9));
  return t * t * (3 - 2 * t);
}

/**
 * Sample terrain height at world (x, z).
 * `time` must be the same value written to uTime (elapsed * bpm/120).
 */
export function sampleTerrainHeight(
  px: number,
  pz: number,
  time: number,
  audioLevel: number,
  highlightIdx: number,
  sources: TerrainWaveSource[],
  bpm: number,
  planetCount = sources.length,
): number {
  const radius = Math.hypot(px, pz);
  const mask = diskMask(radius);
  if (mask <= 0.001) return 0;

  const rhythmicSpeed = 0.55 + clamp01((bpm - 60) / 80) * 0.8;
  let displacement = 0;

  const count = Math.min(planetCount, sources.length, 10);
  for (let i = 0; i < count; i += 1) {
    const source = sources[i];
    if (!source) continue;
    const dist = Math.hypot(px - source.x, pz - source.z);
    let isolation = 1;
    if (highlightIdx >= 0) {
      isolation = i === highlightIdx ? 2.2 : 0.05;
    }
    const wave = Math.sin(
      source.frequency * dist - time * rhythmicSpeed * (1.15 + source.frequency * 0.04),
    );
    displacement +=
      source.amplitude * isolation * wave * Math.exp(-TERRAIN_GLOBAL_DAMPING * dist);
  }

  const audioScale = 0.55 + clamp01(audioLevel) * 0.7;
  displacement *= mask * TERRAIN_DISPLACEMENT_SCALE * audioScale;
  return displacement;
}
