/**
 * Melody audition: generate N candidates, soft-score, select best.
 * Deterministic: same seed => same selected index and plan.
 * No Math.random; use seed + stable keys.
 */

import type { EventToken } from '../contracts';
import type { HookCell } from './melody-grammar';
import {
  computeMelodyMetrics,
  countHookCellOccurrences,
} from './melody-grammar';

const BARS = 16;
const PHRASE = 4;

/** Soft scorer context: hookCell, getChordTonesForBar, secondsPerBeat. */
export interface SoftScorerContext {
  hookCell: HookCell;
  getChordTonesForBar: (bar: number) => number[];
  secondsPerBeat: number;
}

/**
 * Soft penalty: prefer value near target; smooth falloff.
 * Returns 1 at target, ~0 when far. Width = how quickly it drops.
 */
function softPeak(value: number, target: number, width: number): number {
  const d = (value - target) / Math.max(0.01, width);
  return Math.exp(-(d * d));
}

/**
 * Soft band: prefer value in [lo, hi]; 1 inside, smooth drop outside.
 */
function softBand(value: number, lo: number, hi: number, margin: number): number {
  if (value >= lo && value <= hi) return 1;
  if (value < lo) return Math.exp(-Math.pow((lo - value) / Math.max(0.01, margin), 2));
  return Math.exp(-Math.pow((value - hi) / Math.max(0.01, margin), 2));
}

/**
 * Bar-to-bar repetition: count consecutive bars with identical pitch sequence (by pitch classes).
 * Returns fraction of bar pairs that are repeats (0 = no repetition, 1 = all same).
 */
function barRepetitionRate(melodyEvents: EventToken[], secondsPerBeat: number): number {
  const beatsPerBar = 4;
  const barSec = beatsPerBar * secondsPerBeat;
  let pairs = 0;
  let repeats = 0;
  for (let bar = 0; bar < BARS - 1; bar++) {
    const barStart = bar * barSec;
    const nextStart = (bar + 1) * barSec;
    const thisBar = melodyEvents
      .filter(e => e.t0 >= barStart - 0.001 && e.t0 < barStart + barSec + 0.001)
      .map(e => e.pitch % 12)
      .join(',');
    const nextBar = melodyEvents
      .filter(e => e.t0 >= nextStart - 0.001 && e.t0 < nextStart + barSec + 0.001)
      .map(e => e.pitch % 12)
      .join(',');
    if (thisBar.length > 0 && nextBar.length > 0) {
      pairs++;
      if (thisBar === nextBar) repeats++;
    }
  }
  return pairs > 0 ? repeats / pairs : 0;
}

/**
 * Phrase contrast: B section should have higher mean pitch or density than A; final A return.
 * Returns 0..1 (1 = good contrast).
 */
function phraseContrastScore(melodyEvents: EventToken[], secondsPerBeat: number): number {
  const beatsPerBar = 4;
  const barSec = beatsPerBar * secondsPerBeat;
  const meanPitchByPhrase: number[] = [];
  const countByPhrase: number[] = [];
  for (let p = 0; p < 4; p++) {
    let sum = 0;
    let n = 0;
    for (let bar = p * PHRASE; bar < (p + 1) * PHRASE; bar++) {
      const barStart = bar * barSec;
      const inBar = melodyEvents.filter(
        e => e.t0 >= barStart - 0.001 && e.t0 < barStart + barSec + 0.001
      );
      for (const e of inBar) {
        sum += e.pitch;
        n++;
      }
    }
    meanPitchByPhrase.push(n > 0 ? sum / n : 0);
    countByPhrase.push(n);
  }
  // B (index 2) should be >= A (0) in pitch or density; final A (3) can be similar to A (0)
  let score = 0.5;
  if (meanPitchByPhrase[2] > 0 && meanPitchByPhrase[0] > 0 && meanPitchByPhrase[2] >= meanPitchByPhrase[0] - 2) {
    score += 0.25;
  }
  if (countByPhrase[2] >= countByPhrase[0] - 2) {
    score += 0.25;
  }
  return Math.min(1, score);
}

/**
 * Create a soft melody scorer. Prefers:
 * - Hook recurrence in 6–10 range
 * - Strong-beat chord tone rate good but not perfect
 * - Stepwise rate in reasonable band (avoid monotone / constant leaps)
 * - Leap resolution high
 * - Rest density: some breathing
 * - Phrase contrast (B vs A, final A return)
 * - Novelty: penalize bar-to-bar identical pitch sequences
 */
export function createSoftMelodyScorer(ctx: SoftScorerContext): (melodyEvents: EventToken[]) => number {
  return function scoreMelody(melodyEvents: EventToken[]): number {
    const metrics = computeMelodyMetrics(
      melodyEvents,
      ctx.hookCell,
      ctx.secondsPerBeat,
      ctx.getChordTonesForBar
    );
    const { total: hookOcc } = countHookCellOccurrences(
      melodyEvents,
      ctx.hookCell,
      ctx.secondsPerBeat
    );

    let score = 0;

    // Hook recurrence: target 6–10 (soft peak around 8)
    score += 0.2 * softPeak(hookOcc, 8, 3);

    // Strong-beat chord tone: prefer 0.5–0.85 (good but not rigid)
    score += 0.2 * softBand(metrics.chordToneOnStrongBeatRate, 0.5, 0.85, 0.2);

    // Stepwise rate: prefer 0.35–0.75 (avoid monotone scales; avoid constant leaps)
    score += 0.15 * softBand(metrics.averageStepwiseRate, 0.35, 0.75, 0.2);

    // Leap resolution: prefer higher
    score += 0.15 * metrics.leapResolutionRate;

    // Rest density: prefer some breathing (rest density per phrase not all 0)
    const avgRest = metrics.restDensityPerPhrase.reduce((a, b) => a + b, 0) / 4;
    score += 0.1 * softBand(avgRest, 0.1, 0.5, 0.2);

    // Phrase contrast
    score += 0.1 * phraseContrastScore(melodyEvents, ctx.secondsPerBeat);

    // Novelty: penalize bar-to-bar repetition (identical 1-bar pitch sequences)
    const repRate = barRepetitionRate(melodyEvents, ctx.secondsPerBeat);
    score += 0.1 * (1 - repRate);

    return score;
  };
}

const DEFAULT_MELODY_CANDIDATE_COUNT = 6;

/**
 * Audition N melody candidates: build each with buildOne(candidateSeed), score, return best.
 * Deterministic: same seed => same selected index and same winning melody.
 */
export function auditionMelodyCandidates(
  buildOne: (candidateSeed: string) => EventToken[],
  seed: string,
  scoreFn: (melody: EventToken[]) => number,
  N: number = DEFAULT_MELODY_CANDIDATE_COUNT
): { melody: EventToken[]; selectedIndex: number; scores: number[] } {
  const candidates: EventToken[][] = [];
  const scores: number[] = [];

  for (let i = 0; i < N; i++) {
    const candidateSeed = `${seed}:melodyCandidate:${i}`;
    const melody = buildOne(candidateSeed);
    candidates.push(melody);
    scores.push(scoreFn(melody));
  }

  let bestIdx = 0;
  let bestScore = scores[0];
  for (let i = 1; i < N; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      bestIdx = i;
    }
  }

  return {
    melody: candidates[bestIdx],
    selectedIndex: bestIdx,
    scores,
  };
}
