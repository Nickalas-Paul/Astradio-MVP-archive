/**
 * Phase 3.5 — buildVizPayload: deterministic viz payload from snapshot + plan + compose_meta.
 * Pure function; checksum = sha256(canonical JSON).
 */

import type { VizPayload, VizPayloadChart, VizPayloadPlan } from './types';

export interface EphemerisSnapshotLike {
  houses: number[];
  planets: Array<{ name: string; lon: number }>;
  aspects: Array<{ a: string; b: string; type: string; orb: number }>;
}

export interface PlanLike {
  bpm?: number;
  durationSec?: number;
}

export interface ComposeMeta {
  provider_used: string;
  duration_s?: number;
  seed: string;
  controls?: {
    arc_shape?: number;
    density_level?: number;
    tempo_norm?: number;
    aspect_tension?: number;
  };
}

function buildChart(snapshot: EphemerisSnapshotLike): VizPayloadChart {
  const houses = snapshot.houses ?? [];
  const planetLongitudes: Record<string, number> = {};
  for (const p of snapshot.planets ?? []) {
    planetLongitudes[p.name] = p.lon;
  }
  const aspects = (snapshot.aspects ?? []).map((a) => ({
    p1: a.a,
    p2: a.b,
    type: a.type,
    orb: a.orb,
  }));
  const asc = houses[0];
  const mc = houses[9];
  return {
    houses,
    angles: { asc, mc },
    planetLongitudes,
    aspects,
  };
}

function buildPlan(plan: PlanLike, controls?: ComposeMeta['controls']): VizPayloadPlan {
  const bpm = plan.bpm ?? 90;
  const durationSec = plan.durationSec ?? 30;
  const tempo = bpm / 120;
  const density = typeof controls?.density_level === 'number' ? controls.density_level : 0.5;
  const arc = typeof controls?.arc_shape === 'number' ? controls.arc_shape : 0.5;
  const tension = typeof controls?.aspect_tension === 'number' ? controls.aspect_tension : 0.5;
  const brightness = 0.5 + arc * 0.3;
  return {
    tempo,
    density,
    arc,
    tension,
    brightness,
    bpm,
    durationSec,
  };
}

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(
    (k) => JSON.stringify(k) + ':' + canonicalStringify((obj as Record<string, unknown>)[k])
  );
  return '{' + pairs.join(',') + '}';
}

async function sha256Hex(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface BuildVizPayloadResult {
  payload: VizPayload;
  checksum: string;
}

export async function buildVizPayload(
  snapshot: EphemerisSnapshotLike,
  plan: PlanLike,
  compose_meta: ComposeMeta
): Promise<BuildVizPayloadResult> {
  const chart = buildChart(snapshot);
  const planPayload = buildPlan(plan, compose_meta.controls);
  const payload: VizPayload = {
    chart,
    plan: planPayload,
    audioMeta: {
      provider_used: compose_meta.provider_used,
      duration_s: compose_meta.duration_s,
    },
    seed: compose_meta.seed,
  };
  const canonical = canonicalStringify(payload);
  const checksum = await sha256Hex(canonical);
  return { payload, checksum };
}
