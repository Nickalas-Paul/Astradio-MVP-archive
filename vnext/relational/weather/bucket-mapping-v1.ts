/**
 * Stage 7 v1 — Map each cross-aspect hit into structural signal buckets (filtered sums).
 */

import type { CrossAspectHitInternal } from './cross-aspects-v1';

export type MemberBucketTotalsV1 = {
  harmony: number;
  friction: number;
  intensity: number;
  emotional_activation: number;
  communication_emphasis: number;
  volatility: number;
  growth_pressure: number;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function isPersonal(name: string): boolean {
  const n = name.toLowerCase();
  return n === 'sun' || n === 'moon' || n === 'mercury' || n === 'venus' || n === 'mars';
}

function isOuter(name: string): boolean {
  const n = name.toLowerCase();
  return n === 'jupiter' || n === 'saturn' || n === 'uranus' || n === 'neptune' || n === 'pluto';
}

/**
 * Sum contributions into raw bucket totals for one member's hit list.
 */
export function sumBucketsForHits(hits: CrossAspectHitInternal[]): MemberBucketTotalsV1 {
  const t: MemberBucketTotalsV1 = {
    harmony: 0,
    friction: 0,
    intensity: 0,
    emotional_activation: 0,
    communication_emphasis: 0,
    volatility: 0,
    growth_pressure: 0,
  };

  for (const h of hits) {
    const w = h.weight;
    const dyn = h.dynamics;
    const tt = h.transitBody.toLowerCase();
    const nn = h.natalBody.toLowerCase();

    if (dyn === 'supportive' || dyn === 'flowing') t.harmony += w;
    if (dyn === 'tense' || dyn === 'polarizing') t.friction += w;
    /** Total weighted geometric activity in the cross-aspect field (all hits). */
    t.intensity += w;

    if (tt === 'moon' || tt === 'venus' || nn === 'moon' || nn === 'venus') {
      t.emotional_activation += w;
    }
    if (tt === 'mercury' || nn === 'mercury') {
      t.communication_emphasis += w;
    }
    if ((h.type === 'square' || h.type === 'opposition') && (tt === 'mars' || tt === 'uranus' || nn === 'mars' || nn === 'uranus')) {
      t.volatility += w;
    }
    if (
      (h.type === 'conjunction' || h.type === 'square' || h.type === 'opposition') &&
      (tt === 'saturn' || tt === 'pluto' || nn === 'saturn' || nn === 'pluto')
    ) {
      t.growth_pressure += w;
    }
    if (isOuter(tt) && isPersonal(nn)) {
      t.growth_pressure += w * 0.08;
    }
  }

  return t;
}

/**
 * Intensity channel only: monotonic non-linear map to reduce linear-cap saturation.
 * norm = clamp01(1 - exp(-raw / cap)), cap = RW_V1_BUCKET_CAP in callers.
 */
export function normalizeIntensityBucket(raw: number, cap: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (!Number.isFinite(cap) || cap <= 0) return clamp01(raw);
  return clamp01(1 - Math.exp(-raw / cap));
}

/** Per-member normalize then connection-level mean in fold-mean. */
export function normalizeMemberBuckets(totals: MemberBucketTotalsV1, cap: number): MemberBucketTotalsV1 {
  const n = (x: number) => clamp01(x / cap);
  return {
    harmony: n(totals.harmony),
    friction: n(totals.friction),
    intensity: normalizeIntensityBucket(totals.intensity, cap),
    emotional_activation: n(totals.emotional_activation),
    communication_emphasis: n(totals.communication_emphasis),
    volatility: n(totals.volatility),
    growth_pressure: n(totals.growth_pressure),
  };
}
