/**
 * Deterministic plan summarizer for explainer (personality/music-facts atoms).
 * Uses only plan data; no imports from critics or planner.
 */

import type { Plan, EventToken } from '../contracts';

const ENCOUNTER_SEC = 15;
const RECOGNITION_SEC = 30;
const INTEGRATION_START_SEC = 45;

export type PlanSummary = {
  bpm: number;
  key: string;
  durationSec: number;
  melodyEventCount: number;
  harmonyEventCount: number;
  avgMelodicInterval?: number;
  registerMin?: number;
  registerMax?: number;
  encounterUniqueRoots?: number;
  integrationTonicPull?: number;
  densityBucket: 'sparse' | 'balanced' | 'dense';
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function buildPlanSummary(plan: Plan): PlanSummary {
  const melody = (plan.events ?? []).filter(
    (e): e is EventToken => e.channel === 'melody'
  );
  const harmony = (plan.events ?? []).filter(
    (e): e is EventToken => e.channel === 'harmony'
  );

  const melodyEventCount = melody.length;
  const harmonyEventCount = harmony.length;

  let avgMelodicInterval: number | undefined;
  if (melody.length >= 2) {
    const sorted = [...melody].sort((a, b) => a.t0 - b.t0);
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(Math.abs(sorted[i].pitch - sorted[i - 1].pitch));
    }
    avgMelodicInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  const pitches = melody.map((e) => e.pitch);
  const registerMin = pitches.length ? Math.min(...pitches) : undefined;
  const registerMax = pitches.length ? Math.max(...pitches) : undefined;

  const encounterHarmony = harmony.filter((e) => e.t0 < ENCOUNTER_SEC);
  const encounterRoots = encounterHarmony.map((e) => e.pitch % 12);
  const encounterUniqueRoots = encounterRoots.length
    ? new Set(encounterRoots).size
    : undefined;

  let integrationTonicPull: number | undefined;
  const integrationMel = melody.filter(
    (e) => e.t0 >= INTEGRATION_START_SEC && e.t1 <= plan.durationSec + 1
  );
  const integrationHarm = harmony.filter((e) => e.t0 >= INTEGRATION_START_SEC);
  if (integrationMel.length > 0 && integrationHarm.length > 0) {
    const lastMel = integrationMel[integrationMel.length - 1];
    const lastHarmRoot = Math.min(
      ...integrationHarm.slice(-4).map((e) => e.pitch)
    );
    const rootPc = lastHarmRoot % 12;
    integrationTonicPull = lastMel.pitch % 12 === rootPc ? 1 : 0.5;
  }

  const totalEvents = plan.events?.length ?? 0;
  let densityBucket: 'sparse' | 'balanced' | 'dense' = 'balanced';
  if (totalEvents <= 80) densityBucket = 'sparse';
  else if (totalEvents >= 140) densityBucket = 'dense';

  return {
    bpm: plan.bpm,
    key: plan.key,
    durationSec: plan.durationSec,
    melodyEventCount,
    harmonyEventCount,
    avgMelodicInterval,
    registerMin,
    registerMax,
    encounterUniqueRoots,
    integrationTonicPull,
    densityBucket
  };
}
