/**
 * Stage 7 v1 — Deterministic raw score and significance (group-size safe).
 */

import type { ConnectionActivationV1 } from './fold-mean-v1';
import type { CrossAspectHitInternal } from './cross-aspects-v1';
import { RW_V1_EXACTNESS_TAU } from './constants-v1';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Raw = equal mean of seven activation channels (already [0,1]).
 */
export function computeRawScore(activation: ConnectionActivationV1): number {
  const s =
    activation.harmony +
    activation.friction +
    activation.intensity +
    activation.emotional_activation +
    activation.communication_emphasis +
    activation.volatility +
    activation.growth_pressure;
  return clamp01(s / 7);
}

/**
 * Per-member hit count (exactness threshold), then arithmetic mean across members.
 * significance = raw * ln(1 + H_mean) — dampens group inflation vs raw hit totals.
 */
export function computeSignificance(
  raw: number,
  hitsByMember: CrossAspectHitInternal[][]
): number {
  const k = hitsByMember.length;
  if (k === 0) return 0;
  let sumH = 0;
  for (const hits of hitsByMember) {
    const c = hits.filter((h) => h.exactness > RW_V1_EXACTNESS_TAU).length;
    sumH += c;
  }
  const hMean = sumH / k;
  const sig = raw * Math.log(1 + hMean);
  return Math.round(sig * 1e6) / 1e6;
}
