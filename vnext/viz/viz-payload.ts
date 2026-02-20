/**
 * Server-side viz payload generator. Deterministic; seeded RNG only.
 * When VNEXT_VIZ=1, compose uses this to return a non-null viz object for frontend VizCanvas.
 * Contract aligned with apps/web/src/core/viz/engine.ts VizPayload (no frontend import).
 */

import type { Plan } from '../contracts';

export interface VizPayload {
  vizVersion: string;
  duration: number;
  theme: { palette: string[]; accent: string };
  timeline: {
    beats: Array<{ t: number; event: 'beat'; strength: number }>;
    sections: Array<{ start: number; end: number; kind: 'intro' | 'verse' | 'chorus' | 'bridge' }>;
    astro: Array<{ t: number; feature: string; weight: number }>;
  };
  uniforms: {
    rotation: number[];
    scale: number[];
    emission: number[];
    hueShift: number[];
    radialFocus: number[];
  };
  wheelOverlay: { highlight: string[]; aspectLines: Array<{ p1: string; p2: string; type: string }> };
  renderer: { type: 'svg' | 'webgl2'; quality: 'low' | 'high' };
}

export interface VizBuildInput {
  plan: Plan;
  /** Control-surface style: element_dominance, arc_shape, density_level, tempo_norm, aspect_tension, etc. */
  payload: {
    element_dominance?: string;
    arc_shape?: number;
    density_level?: number;
    tempo_norm?: number;
    aspect_tension?: number;
    [k: string]: unknown;
  };
  seed: string;
}

function seededRNG(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state ^ seed.charCodeAt(i)) >>> 0;
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
  }
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state >>>= 0;
    state ^= state << 5;
    state >>>= 0;
    return (state >>> 0) / 0xffffffff;
  };
}

function hueForElement(el: string): number {
  const m: Record<string, number> = { fire: 0, earth: 60, air: 180, water: 240 };
  return m[el] ?? 0;
}

/**
 * Build deterministic viz payload from plan + payload + seed.
 */
export function buildVizPayload(input: VizBuildInput): VizPayload {
  const { plan, payload, seed } = input;
  const rand = seededRNG(seed);
  const duration = plan.durationSec ?? 30;
  const bpm = plan.bpm || 90;
  const beatsPerSec = bpm / 60;
  const beatInterval = 1 / beatsPerSec;

  const beatGrid: number[] = [];
  for (let t = 0; t < duration; t += beatInterval) {
    beatGrid.push(t);
  }

  const arcShape = typeof payload.arc_shape === 'number' ? payload.arc_shape : 0.5;
  const densityLevel = typeof payload.density_level === 'number' ? payload.density_level : 0.5;
  const tempoNorm = typeof payload.tempo_norm === 'number' ? payload.tempo_norm : 0.5;
  const aspectTension = typeof payload.aspect_tension === 'number' ? payload.aspect_tension : 0.5;
  const elementDominance = (payload.element_dominance as string) || 'fire';

  const theme = (() => {
    const baseHue = hueForElement(elementDominance);
    return {
      palette: [
        `hsl(${baseHue}, 70%, 50%)`,
        `hsl(${baseHue + 30}, 60%, 60%)`,
        `hsl(${baseHue - 30}, 80%, 40%)`,
      ],
      accent: `hsl(${baseHue + (rand() * 60 - 30)}, 80%, 60%)`,
    };
  })();

  const timeline = {
    beats: beatGrid.map((t) => ({
      t,
      event: 'beat' as const,
      strength: 0.5 + tempoNorm * 0.5 + (rand() * 0.2 - 0.1),
    })),
    sections: [
      { start: 0, end: duration * 0.25, kind: 'intro' as const },
      { start: duration * 0.25, end: duration * 0.75, kind: 'verse' as const },
      { start: duration * 0.75, end: duration, kind: 'chorus' as const },
    ],
    astro: [
      { t: 0, feature: 'aspect:tension', weight: aspectTension + (rand() * 0.2 - 0.1) },
      { t: duration * 0.25, feature: 'phase:recognition', weight: 0.7 },
      { t: duration * 0.75, feature: 'phase:integration', weight: 0.8 },
    ],
  };

  const uniforms = {
    rotation: beatGrid.map(() => rand() * 360 * tempoNorm),
    scale: beatGrid.map(() => 0.8 + densityLevel * 0.4 + (rand() * 0.2 - 0.1)),
    emission: beatGrid.map(() => arcShape + (rand() * 0.3 - 0.15)),
    hueShift: beatGrid.map(() => rand() * 60 - 30),
    radialFocus: beatGrid.map(() => arcShape + (rand() * 0.4 - 0.2)),
  };

  const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const wheelOverlay = {
    highlight: planets.slice(0, Math.floor(2 + densityLevel * 3)),
    aspectLines: Array.from(
      { length: Math.floor(aspectTension * 4) },
      () => ({
        p1: planets[Math.floor(rand() * planets.length)],
        p2: planets[Math.floor(rand() * planets.length)],
        type: ['conjunction', 'opposition', 'trine', 'square'][Math.floor(rand() * 4)],
      })
    ),
  };

  return {
    vizVersion: '1.0',
    duration,
    theme,
    timeline,
    uniforms,
    wheelOverlay,
    renderer: { type: 'svg', quality: 'high' },
  };
}
