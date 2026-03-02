/**
 * Phase 5 — Composite vector -> ControlSurfacePayload mapping for group compose.
 * Deterministic and pure: same featureVec + seed => same payload.
 *
 * Strategy:
 * - Start from existing deterministic controlPayloadFromSeed(seed)
 * - Override element_dominance based on composite featureVec element dims (27–30)
 * - Override aspect_tension from tension index (32)
 */

import type { ControlSurfacePayload } from '../../explainer/contracts';
import { controlPayloadFromSeed } from '../../compat/payload-from-seed';
import {
  FEATURE_ELEMENT_INDICES,
  FEATURE_TENSION_INDEX,
} from '../constants';

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

type ElementLabel = 'fire' | 'earth' | 'air' | 'water';

const ELEMENT_ORDER: ElementLabel[] = ['fire', 'earth', 'air', 'water'];

function dominantElement(featureVec: Float32Array | number[]): ElementLabel {
  const expected = [27, 28, 29, 30];
  if (
    FEATURE_ELEMENT_INDICES.length !== expected.length ||
    FEATURE_ELEMENT_INDICES.some((v, i) => v !== expected[i])
  ) {
    throw new Error(
      `FEATURE_ELEMENT_INDICES invariant violated in vector-to-controls: expected [27,28,29,30], got [${FEATURE_ELEMENT_INDICES.join(
        ','
      )}]`
    );
  }

  const vals = FEATURE_ELEMENT_INDICES.map((i) =>
    Number.isFinite(featureVec[i]) ? (featureVec[i] as number) : 0
  );
  let maxVal = vals[0];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] > maxVal) maxVal = vals[i];
  }
  for (let idx = 0; idx < ELEMENT_ORDER.length; idx++) {
    if (vals[idx] === maxVal) {
      return ELEMENT_ORDER[idx];
    }
  }
  return 'fire';
}

export function vectorToControlPayload(
  featureVec: Float32Array | number[],
  seed: string
): ControlSurfacePayload {
  const base = controlPayloadFromSeed(seed);

  const el = dominantElement(featureVec);
  const tensionRaw =
    Number.isFinite(featureVec[FEATURE_TENSION_INDEX])
      ? (featureVec[FEATURE_TENSION_INDEX] as number)
      : base.aspect_tension;
  const aspect_tension = clamp01(tensionRaw);

  return {
    ...base,
    element_dominance: el,
    aspect_tension,
    hash: seed,
  };
}

