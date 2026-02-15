/**
 * Build a deterministic ControlSurfacePayload from a seed string.
 * Used only for comparison flow; does not affect main compose pipeline.
 */

import type { ControlSurfacePayload } from '../explainer/contracts';
import * as crypto from 'crypto';

const ELEMENTS = ['fire', 'earth', 'air', 'water'] as const;
const MODALITIES = ['cardinal', 'fixed', 'mutable'] as const;

function seededRNG(seedStr: string): () => number {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i);
    h = h >>> 0;
  }
  if (h === 0) h = 0x9e3779b9;
  let state = h >>> 0;
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

/**
 * Deterministic payload from seed. Same seed => same payload.
 */
export function controlPayloadFromSeed(seed: string): ControlSurfacePayload {
  const rng = seededRNG(seed);
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  return {
    arc_shape: clamp01(0.35 + rng() * 0.35),
    density_level: clamp01(0.4 + rng() * 0.4),
    tempo_norm: clamp01(0.5 + rng() * 0.35),
    step_bias: clamp01(0.5 + rng() * 0.4),
    leap_cap: 1 + Math.floor(rng() * 6),
    rhythm_template_id: Math.floor(rng() * 8),
    syncopation_bias: clamp01(rng()),
    motif_rate: clamp01(0.3 + rng() * 0.5),
    element_dominance: ELEMENTS[Math.floor(rng() * ELEMENTS.length)],
    aspect_tension: clamp01(0.2 + rng() * 0.6),
    modality: MODALITIES[Math.floor(rng() * MODALITIES.length)],
    hash: seed
  };
}

export function comparisonSeed(
  chartAId: string,
  chartBId: string,
  relationshipMode: string,
  fusionMethod: string,
  wA: number,
  wB: number
): string {
  const payload = `${chartAId}|${chartBId}|${relationshipMode}|${fusionMethod}|${wA}|${wB}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}
