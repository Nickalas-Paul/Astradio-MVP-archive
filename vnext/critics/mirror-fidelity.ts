// vnext/critics/mirror-fidelity.ts
// Sonic Mirror: rewards stable harmonic center (Encounter), perceptible melodic motion (Recognition),
// coherent settling (Integration), and consistency with motionProfile. Repetition penalty only when inert.

import type { Plan, EventToken } from "../contracts";
import type { ElementBlend, MotionProfile, NarrativeArc } from "../astro/guidance";

const ENCOUNTER_SEC = 15;
const RECOGNITION_SEC = 30;
const INTEGRATION_SEC = 15;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function phaseFromTime(tSec: number): 0 | 1 | 2 {
  if (tSec < ENCOUNTER_SEC) return 0;
  if (tSec < ENCOUNTER_SEC + RECOGNITION_SEC) return 1;
  return 2;
}

export interface MirrorFidelityScores {
  encounterStability: number;
  recognitionMotion: number;
  integrationCoherence: number;
  motionProfileFit: number;
  repetitionPenalty: number;
  score: number;
}

export type SonicMirrorGuidance = {
  elementBlend?: ElementBlend;
  motionProfile?: MotionProfile;
  narrativeArc?: NarrativeArc;
};

/**
 * Score mirror fidelity: stable harmonic center in Encounter, perceptible melodic motion in Recognition,
 * coherent settling in Integration, consistency with motionProfile. Penalize only inert repetition.
 */
export function scoreMirrorFidelity(plan: Plan, guidance: SonicMirrorGuidance): MirrorFidelityScores {
  const motionProfile = guidance.motionProfile;
  const bpm = plan.bpm;
  const secPerBeat = 60 / bpm;

  const melody = plan.events
    .filter((e): e is EventToken => e.channel === "melody")
    .sort((a, b) => a.t0 - b.t0);
  const harmony = plan.events
    .filter((e): e is EventToken => e.channel === "harmony")
    .sort((a, b) => a.t0 - b.t0);

  const encounterStability = scoreEncounterStability(harmony, bpm, secPerBeat);
  const recognitionMotion = scoreRecognitionMotion(melody, bpm, secPerBeat);
  const integrationCoherence = scoreIntegrationCoherence(melody, harmony, bpm, secPerBeat);
  const motionProfileFit = motionProfile
    ? scoreMotionProfileFit(melody, harmony, motionProfile, bpm, secPerBeat)
    : 0.5;
  const repetitionPenalty = scoreRepetitionPenalty(melody);

  const score = clamp01(
    (encounterStability * 0.25 +
      recognitionMotion * 0.25 +
      integrationCoherence * 0.25 +
      motionProfileFit * 0.2 -
      repetitionPenalty * 0.05)
  );

  return {
    encounterStability,
    recognitionMotion,
    integrationCoherence,
    motionProfileFit,
    repetitionPenalty,
    score,
  };
}

function scoreEncounterStability(
  harmony: EventToken[],
  bpm: number,
  secPerBeat: number
): number {
  const encounterEndSec = ENCOUNTER_SEC;
  const encounterHarmony = harmony.filter((e) => e.t0 < encounterEndSec);
  if (encounterHarmony.length < 2) return 0.5;
  const roots = encounterHarmony.map((e) => e.pitch % 12);
  const uniqueRoots = new Set(roots);
  const stability = 1 - (uniqueRoots.size - 1) * 0.25;
  return clamp01(stability);
}

function scoreRecognitionMotion(
  melody: EventToken[],
  bpm: number,
  secPerBeat: number
): number {
  const start = ENCOUNTER_SEC;
  const end = ENCOUNTER_SEC + RECOGNITION_SEC;
  const inPhase = melody.filter((e) => e.t0 >= start && e.t0 < end);
  if (inPhase.length < 4) return 0.3;
  const countScore = clamp01(inPhase.length / 20);
  const deltas = inPhase.slice(1).map((e, i) => e.pitch - inPhase[i].pitch);
  const motion = deltas.length ? deltas.reduce((a, b) => a + Math.abs(b), 0) / deltas.length : 0;
  const motionScore = clamp01(motion / 4);
  return clamp01((countScore + motionScore) / 2);
}

function scoreIntegrationCoherence(
  melody: EventToken[],
  harmony: EventToken[],
  bpm: number,
  secPerBeat: number
): number {
  const start = ENCOUNTER_SEC + RECOGNITION_SEC;
  const end = start + INTEGRATION_SEC;
  const melIn = melody.filter((e) => e.t0 >= start && e.t1 <= end + 1);
  const harmIn = harmony.filter((e) => e.t0 >= start);
  if (melIn.length === 0 && harmIn.length === 0) return 0.5;
  const lastMel = melIn[melIn.length - 1];
  const lastHarm = harmIn[harmIn.length - 1];
  if (!lastMel || !lastHarm) return 0.5;
  const root = Math.min(...harmIn.slice(-4).map((e) => e.pitch));
  const tonicPull = lastMel.pitch % 12 === root % 12 ? 1 : 0.5;
  return clamp01(0.5 + tonicPull * 0.5);
}

function scoreMotionProfileFit(
  melody: EventToken[],
  harmony: EventToken[],
  profile: MotionProfile,
  bpm: number,
  secPerBeat: number
): number {
  const durations = melody.map((e) => e.t1 - e.t0);
  const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0.5;
  const flowFit = 1 - Math.abs(avgDur - 0.5 - profile.flow * 0.3) * 2;
  const gravityFit = profile.gravity >= 0.5 ? 1 : 0.7;
  return clamp01((clamp01(flowFit) + gravityFit) / 2);
}

function scoreRepetitionPenalty(melody: EventToken[]): number {
  if (melody.length < 8) return 0;
  const pitches = melody.map((e) => e.pitch);
  const runs: number[] = [];
  let run = 1;
  for (let i = 1; i < pitches.length; i++) {
    if (pitches[i] === pitches[i - 1]) run++;
    else {
      runs.push(run);
      run = 1;
    }
  }
  runs.push(run);
  const maxRun = Math.max(...runs);
  const inert = maxRun >= 6 ? 0.5 : maxRun >= 4 ? 0.2 : 0;
  return inert;
}
