/**
 * Melody Grammar + Motif Memory layer.
 * - Hook cell: 2–4 notes (degrees + rhythm) derived from motifId; recurrence 6–10x, section-weighted.
 * - Grammar repair: strong-beat chord tones, leap resolution, phrase cadence, register narrative.
 * All deterministic (seed + stable keys).
 */

import type { EventToken } from '../contracts';
import type { HookNote } from './libraries';

const BARS = 16;
const PHRASE = 4;
const GRID_16 = 4;
const NATURAL_MINOR_SEMI = [0, 2, 3, 5, 7, 8, 10, 10]; // degree index 0..7 -> semitone

function hashU32(seed: string, key: string): number {
  let h = 0;
  const s = seed + '\0' + key;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h & h;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function rand01(seed: string, key: string): number {
  return hashU32(seed, key) / 0x100000000;
}

function degreeToSemitone(degree: number): number {
  const d = ((degree % 8) + 8) % 8;
  return NATURAL_MINOR_SEMI[d] ?? 0;
}

/** Hook cell: 2–4 notes with degrees + rhythm slots for identity. */
export interface HookCell {
  id: string;
  degrees: number[];
  pos16: number[];
  /** Semitone interval pattern between consecutive notes for recognition. */
  intervalPatternSemis: number[];
}

/**
 * Derive a short hook cell (2–4 notes) from motif notes. Deterministic from motifId + seed.
 */
export function extractHookCell(
  motifNotes: HookNote[],
  motifId: number,
  seed: string
): HookCell {
  const valid = motifNotes.filter(n => n.degree >= 0 && n.dur16 > 0);
  const len = Math.min(4, Math.max(2, 2 + (hashU32(seed, 'cell_len') % 3)));
  const start = hashU32(seed, 'cell_start') % Math.max(1, valid.length - len + 1);
  const slice = valid.slice(start, start + len);
  const degrees = slice.map(n => n.degree);
  const pos16 = slice.map(n => n.pos16);
  const intervalPatternSemis: number[] = [];
  for (let i = 1; i < degrees.length; i++) {
    const s0 = degreeToSemitone(degrees[i - 1]);
    const s1 = degreeToSemitone(degrees[i]);
    intervalPatternSemis.push(s1 - s0);
  }
  const id = `cell_${motifId}_${degrees.join('')}_${pos16.join('')}`;
  return { id, degrees, pos16, intervalPatternSemis };
}

/** Section indices: 0=A, 1=A', 2=B, 3=A. */
function sectionForBar(bar: number): number {
  const phraseIdx = Math.floor(bar / PHRASE);
  return phraseIdx === 3 ? 0 : phraseIdx;
}

/**
 * Count how many bars contain the hook cell (by interval pattern match on melody degrees).
 * Uses melody events grouped by bar; matches if bar has a run of degrees matching cell.intervalPattern.
 */
export function countHookCellOccurrences(
  melodyEvents: EventToken[],
  hookCell: HookCell,
  secondsPerBeat: number
): { total: number; bySection: [number, number, number, number] } {
  const bySection: [number, number, number, number] = [0, 0, 0, 0];
  const beatsPerBar = 4;
  const barSec = beatsPerBar * secondsPerBeat;

  for (let bar = 0; bar < BARS; bar++) {
    const barStart = bar * barSec;
    const barEnd = barStart + barSec;
    const inBar = melodyEvents.filter(e => e.t0 >= barStart - 0.001 && e.t0 < barEnd + 0.001);
    const pitches = inBar.map(e => e.pitch).filter((_, i) => inBar[i].velocity > 0);
    if (pitches.length < 2) continue;

    const intervals: number[] = [];
    for (let j = 1; j < pitches.length; j++) {
      intervals.push(pitches[j] - pitches[j - 1]);
    }

    let found = false;
    if (hookCell.intervalPatternSemis.length > 0 && intervals.length >= hookCell.intervalPatternSemis.length) {
      for (let i = 0; i <= intervals.length - hookCell.intervalPatternSemis.length; i++) {
        let match = true;
        for (let k = 0; k < hookCell.intervalPatternSemis.length; k++) {
          if (Math.abs(intervals[i + k] - hookCell.intervalPatternSemis[k]) > 1) {
            match = false;
            break;
          }
        }
        if (match) {
          found = true;
          break;
        }
      }
    }
    if (found) {
      const sec = sectionForBar(bar);
      bySection[sec]++;
    }
  }

  const total = bySection[0] + bySection[1] + bySection[2] + bySection[3];
  return { total, bySection };
}

export interface MelodyGrammarOptions {
  seed: string;
  bpm: number;
  phraseCenters: number[];
  getChordTonesForBar: (bar: number) => number[];
  /** Strong-beat chord tone target probability (e.g. 0.65). */
  strongBeatChordToneBias?: number;
  /** Register band half-width in semitones (e.g. 7). */
  registerBandHalfWidth?: number;
  /** B section register lift in semitones (e.g. +4). */
  bSectionLift?: number;
}

/**
 * Repair melody events: strong-beat chord tones, leap resolution, phrase cadence, register band.
 * Mutates pitch/velocity in place where needed; deterministic from seed.
 */
export function applyMelodyGrammarRepair(
  melodyEvents: EventToken[],
  options: MelodyGrammarOptions
): void {
  const {
    seed,
    bpm,
    phraseCenters,
    getChordTonesForBar,
    strongBeatChordToneBias = 0.65,
    registerBandHalfWidth = 7,
    bSectionLift = 4,
  } = options;

  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = 4;
  const barSec = beatsPerBar * secondsPerBeat;

  for (let i = 0; i < melodyEvents.length; i++) {
    const e = melodyEvents[i];
    const bar = Math.floor(e.t0 / barSec);
    const beatInBar = (e.t0 / secondsPerBeat) % 4;
    const phraseIdx = Math.floor(bar / PHRASE);
    const barInPhrase = bar % PHRASE;
    const isCadenceBar = barInPhrase === 3;
    const isBSection = phraseIdx === 2;

    const chordTones = getChordTonesForBar(bar);
    const center = phraseCenters[phraseIdx];
    const bandLo = center - registerBandHalfWidth;
    const bandHi = center + registerBandHalfWidth + (isBSection ? bSectionLift : 0);

    let pitch = e.pitch;
    const pitchClass = (pitch % 12 + 12) % 12;
    const degreeFromCenter = pitch - center;

    // Strong beats (0, 2): bias toward chord tone
    const isStrongBeat = beatInBar < 0.25 || (beatInBar >= 1.75 && beatInBar < 2.25) || Math.abs(beatInBar - 2) < 0.25;
    if (isStrongBeat && chordTones.length > 0) {
      const semis = chordTones.map(degreeToSemitone);
      const rootPc = 9; // A
      const chordPcs = new Set(semis.map(s => (rootPc + s) % 12));
      if (!chordPcs.has(pitchClass) && rand01(seed, `ct_${bar}_${i}`) < strongBeatChordToneBias) {
        const ref = 57 + Math.round((pitch - 57) / 12) * 12;
        let bestPitch = pitch;
        let bestDist = 99;
        for (const s of semis) {
          for (let oct = -12; oct <= 12; oct += 12) {
            const cand = ref + s + oct;
            const d = Math.abs(cand - pitch);
            if (d < bestDist) {
              bestDist = d;
              bestPitch = Math.max(24, Math.min(96, cand));
            }
          }
        }
        pitch = bestPitch;
      }
    }

    // Leap resolution: after a leap (>=4 semitones), next note prefers stepwise opposite
    if (i > 0) {
      const prev = melodyEvents[i - 1].pitch;
      const interval = pitch - prev;
      if (Math.abs(interval) >= 4) {
        const nextIdx = i + 1;
        if (nextIdx < melodyEvents.length) {
          const nextPitch = melodyEvents[nextIdx].pitch;
          const nextInterval = nextPitch - pitch;
          if (Math.abs(nextInterval) >= 4 && (interval > 0) === (nextInterval > 0)) {
            const step = interval > 0 ? -2 : 2;
            const repaired = Math.max(24, Math.min(96, melodyEvents[nextIdx].pitch + step));
            melodyEvents[nextIdx].pitch = repaired;
          }
        }
      }
    }

    // Phrase cadence: narrative already sets cadence pitch on last note of cadence bar; no override here.

    // Register narrative: clamp to band
    pitch = Math.max(24, Math.min(96, pitch));
    if (pitch < bandLo) pitch = Math.min(pitch + 12, bandLo + 12);
    if (pitch > bandHi) pitch = Math.max(pitch - 12, bandHi - 12);
    pitch = Math.max(bandLo, Math.min(bandHi, pitch));

    e.pitch = pitch;
  }
}

export interface MelodyMetrics {
  chordToneOnStrongBeatRate: number;
  hookCellOccurrenceCount: number;
  averageStepwiseRate: number;
  leapResolutionRate: number;
  restDensityPerPhrase: [number, number, number, number];
}

/**
 * Compute melody musicality metrics. Deterministic from plan content.
 */
export function computeMelodyMetrics(
  melodyEvents: EventToken[],
  hookCell: HookCell,
  secondsPerBeat: number,
  getChordTonesForBar: (bar: number) => number[]
): MelodyMetrics {
  const beatsPerBar = 4;
  const barSec = beatsPerBar * secondsPerBeat;
  let strongBeatTotal = 0;
  let strongBeatChordTone = 0;
  let stepwiseMoves = 0;
  let totalMoves = 0;
  let leaps = 0;
  let leapsResolved = 0;
  const restDensityPerPhrase: [number, number, number, number] = [0, 0, 0, 0];
  const noteCountPerPhrase: [number, number, number, number] = [0, 0, 0, 0];

  for (let i = 0; i < melodyEvents.length; i++) {
    const e = melodyEvents[i];
    const bar = Math.floor(e.t0 / barSec);
    const beatInBar = (e.t0 / secondsPerBeat) % 4;
    const phraseIdx = Math.min(3, Math.floor(bar / PHRASE));
    noteCountPerPhrase[phraseIdx]++;

    const isStrongBeat = beatInBar < 0.3 || (beatInBar >= 1.7 && beatInBar < 2.3);
    if (isStrongBeat) {
      strongBeatTotal++;
      const chordTones = getChordTonesForBar(bar);
      const semis = chordTones.map(degreeToSemitone);
      const rootPc = 9; // A
      const chordPcs = new Set(semis.map(s => (rootPc + s) % 12));
      const pc = (e.pitch % 12 + 12) % 12;
      if (chordPcs.has(pc)) strongBeatChordTone++;
    }

    if (i > 0) {
      const prev = melodyEvents[i - 1].pitch;
      const interval = e.pitch - prev;
      totalMoves++;
      if (Math.abs(interval) <= 2) stepwiseMoves++;
      if (Math.abs(interval) >= 4) {
        leaps++;
        if (i + 1 < melodyEvents.length) {
          const nextInterval = melodyEvents[i + 1].pitch - e.pitch;
          if (Math.abs(nextInterval) <= 2 && (interval > 0) !== (nextInterval > 0)) {
            leapsResolved++;
          }
        }
      }
    }
  }

  const { total: hookCellOccurrenceCount } = countHookCellOccurrences(melodyEvents, hookCell, secondsPerBeat);

  const barsPerPhrase = 4;
  for (let p = 0; p < 4; p++) {
    const notes = noteCountPerPhrase[p];
    const maxNotes = barsPerPhrase * 6;
    restDensityPerPhrase[p] = 1 - notes / Math.max(1, maxNotes);
  }

  return {
    chordToneOnStrongBeatRate: strongBeatTotal > 0 ? strongBeatChordTone / strongBeatTotal : 0,
    hookCellOccurrenceCount,
    averageStepwiseRate: totalMoves > 0 ? stepwiseMoves / totalMoves : 0,
    leapResolutionRate: leaps > 0 ? leapsResolved / leaps : 1,
    restDensityPerPhrase,
  };
}
