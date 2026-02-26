/**
 * Phase 3.5 Viz Payload Contract
 * Deterministic viz payload for Three.js wheel + energy layers.
 */

export interface VizPayloadChart {
  houses: number[];
  angles: { asc?: number; mc?: number };
  planetLongitudes: Record<string, number>;
  aspects: Array<{ p1: string; p2: string; type: string; orb: number }>;
}

export interface VizPayloadPlan {
  tempo?: number;
  density?: number;
  arc?: number;
  tension?: number;
  brightness?: number;
  bpm?: number;
  durationSec?: number;
}

export interface VizPayloadAudioMeta {
  provider_used: string;
  duration_s?: number;
}

export interface VizPayload {
  chart: VizPayloadChart;
  plan: VizPayloadPlan;
  audioMeta?: VizPayloadAudioMeta;
  seed: string;
}
