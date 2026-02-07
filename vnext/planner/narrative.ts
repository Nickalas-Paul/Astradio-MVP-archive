// vnext/planner/narrative.ts
import { Plan, EventToken } from "../contracts";

/**
 * ML-driven narrative planner (production-safe, deterministic).
 * A A' B A form; motif cells with rests; chord tones on strong beats; approach cadence.
 * - v[0]=tempo, v[1]=brightness, v[2]=density, v[3]=arc, v[4]=motifSel, v[5]=cadenceSel
 * - Melody cap ≤6 notes/bar; density 3–5; stepwise (max 5 semi) except one B leap if arc high.
 * - No Date.now, no Math.random; same (v, guidance) => identical Plan.events and hashes.
 */

type V6 = [number, number, number, number, number, number];

const GRID_16 = 4;
const BARS = 16;
const PHRASE = 4;
const DUR_SEC = 60;
const MAX_MELODY_NOTES_PER_BAR = 6;
const MAX_INTERVAL_SEMI = 5;

// Scale degrees 0..7 in A minor → semitone from tonic (7 = leading).
const DEGREE_TO_SEMI: number[] = [0, 2, 3, 5, 7, 8, 10, 11];
const CADENCE_ENDS = [71, 72, 74, 76];

/** Motif cell: 2 beats = pos16 0–7. degree -1 = rest. */
type MotifNote = { pos16: number; degree: number; dur16: number };
type MotifCell = MotifNote[];

// Deterministic motif cells (2 beats each). pos16 0–7; dur16 0 = rest (omit note).
const MOTIF_CELLS: MotifCell[] = [
  [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 2, dur16: 2 }],
  [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 4, degree: 1, dur16: 2 }, { pos16: 6, degree: 2, dur16: 2 }],
  [{ pos16: 0, degree: 2, dur16: 4 }, { pos16: 6, degree: 1, dur16: 2 }],
  [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 2, degree: 1, dur16: 2 }, { pos16: 4, degree: 0, dur16: 2 }],
  [{ pos16: 0, degree: 4, dur16: 4 }, { pos16: 4, degree: 2, dur16: 4 }],
  [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 6, degree: 2, dur16: 2 }],
  [{ pos16: 0, degree: 2, dur16: 2 }, { pos16: 4, degree: 4, dur16: 2 }],
  [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 2, degree: 2, dur16: 2 }, { pos16: 4, degree: 1, dur16: 2 }],
];

// Progressions: bar 0..3 roots (MIDI) + triad shapes. P1 i–VI–V–i, P2 i–iv–V–i, P3 (B) VI–III–VII–i.
const PROG_ROOTS: number[][] = [
  [57, 53, 52, 57],
  [57, 50, 52, 57],
  [53, 48, 55, 57],
];
const PROG_TRIADS: [number, number, number][] = [
  [0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 3, 7],
];
const PROG_IV_TRIAD: [number, number, number] = [0, 3, 7];
const PROG_III_TRIAD: [number, number, number] = [0, 4, 7];
const PROG_VII_TRIAD: [number, number, number] = [0, 4, 7];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function quantizeTo16th(timeSec: number, bpm: number): number {
  const gridPerSec = (bpm / 60) * GRID_16;
  return Math.round(timeSec * gridPerSec) / gridPerSec;
}

function planIdFrom(
  seed: string | undefined,
  bpm: number,
  baseCenter: number,
  motifIdx: number,
  cadenceIdx: number,
  phraseCenters: number[]
): string {
  if (typeof seed === "string" && seed.length > 0) {
    return `plan_${seed.slice(0, 32)}`;
  }
  const stable = [bpm, baseCenter, motifIdx, cadenceIdx, ...phraseCenters].join("_");
  return `plan_v6_${stable}`;
}

/** Chord tones as scale degrees 0–7 for each bar. P1/P2/P3 per audit. */
const CHORD_TONE_DEGREES: number[][] = [
  [0, 2, 4], [6, 1, 3], [7, 2, 4], [0, 2, 4],
  [0, 2, 4], [3, 5, 0], [7, 2, 4], [0, 2, 4],
  [6, 1, 3], [2, 4, 6], [5, 0, 2], [0, 2, 4],
];
function chordToneDegreesForBar(barInPhrase: number, progId: number, isBSection: boolean): number[] {
  const idx = (isBSection ? 2 : progId) * 4 + barInPhrase;
  return CHORD_TONE_DEGREES[idx] ?? [0, 2, 4];
}

/** Root + triad (MIDI) for bar. */
function chordForBar(barInPhrase: number, progId: number, isBSection: boolean): { root: number; triad: [number, number, number] } {
  const roots = PROG_ROOTS[isBSection ? 2 : progId];
  const r = roots[barInPhrase];
  const shapes: [number, number, number][] = [
    PROG_TRIADS[0], PROG_TRIADS[1], PROG_TRIADS[2], PROG_TRIADS[3],
  ];
  let shape: [number, number, number];
  if (!isBSection) {
    shape = barInPhrase === 1 && progId === 1 ? PROG_IV_TRIAD : shapes[barInPhrase];
  } else {
    shape = barInPhrase === 0 ? shapes[0] : barInPhrase === 1 ? PROG_III_TRIAD : barInPhrase === 2 ? PROG_VII_TRIAD : shapes[3];
  }
  return { root: r, triad: [r + shape[0], r + shape[1], r + shape[2]] };
}

function phraseArcOffset(phraseIdx: number): number {
  const o = [-2, 0, 3, 0];
  return o[phraseIdx];
}

function degreeToSemitone(degree: number): number {
  const d = ((degree % 8) + 8) % 8;
  return DEGREE_TO_SEMI[d] ?? 0;
}

/** Snap degree to nearest chord tone (for strong beats). */
function snapToChordTone(degree: number, chordTones: number[]): number {
  let best = chordTones[0];
  let bestDist = 99;
  for (const c of chordTones) {
    let dist = Math.abs(degree - c);
    if (dist > 4) dist = 8 - dist;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

/** Clamp next degree to stepwise from prevPitch (center + semi), max 5 semitones. */
function stepwiseNextDegree(
  nextDegree: number,
  prevPitch: number,
  center: number,
  maxInterval: number
): number {
  const nextSemi = degreeToSemitone(nextDegree);
  const nextPitch = center + nextSemi;
  const delta = nextPitch - prevPitch;
  if (Math.abs(delta) <= maxInterval) return nextDegree;
  const sign = delta > 0 ? 1 : -1;
  const allowed = prevPitch + sign * maxInterval;
  const allowedRel = allowed - center;
  for (let d = 0; d < 8; d++) {
    if (Math.abs(degreeToSemitone(d) - allowedRel) <= 2) return d;
  }
  return nextDegree;
}

export function planFromVector(
  v: V6,
  guidance?: {
    tempoBias?: number;
    arcBias?: number;
    densityBias?: number;
    motifIdx?: number;
    cadenceIdx?: number;
    seed?: string;
  }
): Plan {
  const [vTempo, vBright, vDense, vArc, vMotif, vCad] = v;

  const tempoBias = guidance?.tempoBias ?? 0;
  const arcBias = guidance?.arcBias ?? 0;
  const densityBias = guidance?.densityBias ?? 0;

  const biasedTempo = clamp01(vTempo * (1 + 0.1 * tempoBias));
  const bpm = Math.round(lerp(70, 140, biasedTempo));
  const baseCenter = Math.round(lerp(55, 67, vBright));

  const biasedArc = clamp01(vArc * (1 + 0.3 * arcBias));
  const arcLift = lerp(3, 10, biasedArc);
  const phraseCenters = [
    baseCenter - Math.round(arcLift * 0.5),
    baseCenter + Math.round(arcLift * 0.4),
    baseCenter + Math.round(arcLift * 1.0),
    baseCenter - Math.round(arcLift * 0.2),
  ];

  const motifIdx =
    guidance?.motifIdx !== undefined
      ? guidance.motifIdx
      : Math.floor(clamp01(vMotif) * MOTIF_CELLS.length);
  const cadenceIdx =
    guidance?.cadenceIdx !== undefined
      ? guidance.cadenceIdx
      : Math.floor(clamp01(vCad) * CADENCE_ENDS.length);
  const cadencePitch = CADENCE_ENDS[cadenceIdx % CADENCE_ENDS.length];

  const biasedDensity = clamp01(vDense + 0.2 * densityBias);
  const density = lerp(0.3, 0.9, biasedDensity);
  const maxNotesPerBar = Math.max(3, Math.min(MAX_MELODY_NOTES_PER_BAR, 3 + Math.floor(density * 3)));

  const progId = (motifIdx + cadenceIdx) % 2;
  const events: EventToken[] = [];
  const secondsPerBeat = 60 / bpm;
  const totalBeats = BARS * 4;
  const one16thSec = (1 / GRID_16) * secondsPerBeat;

  const push = (
    tBeats: number,
    durBeats: number,
    pitch: number,
    vel: number,
    channel: "melody" | "harmony" | "bass" | "rhythm"
  ) => {
    const t0 = quantizeTo16th(tBeats * secondsPerBeat, bpm);
    let t1 = quantizeTo16th((tBeats + durBeats) * secondsPerBeat, bpm);
    if (t1 <= t0) t1 = t0 + one16thSec;
    events.push({ t0, t1, pitch, velocity: vel, channel });
  };

  const motifCell = MOTIF_CELLS[motifIdx % MOTIF_CELLS.length];

  function applyAPrimeTransform(cell: MotifCell, cellIndex: number): MotifCell {
    const out: MotifCell = [];
    for (const n of cell) {
      if (n.degree < 0) { out.push({ ...n }); continue; }
      const shift = (cellIndex % 2 === 0) ? 1 : 0;
      const newPos = Math.max(0, Math.min(7, n.pos16 + shift));
      const newDegree = shift === 0 ? n.degree : (n.degree + 1) % 8;
      out.push({ pos16: newPos, degree: newDegree, dur16: n.dur16 });
    }
    return out;
  }

  const melodyNotesThisBar: { pos16: number; degree: number; dur16: number }[] = [];
  let lastMelodyPitch: number | null = null;
  let usedBLeap = false;

  for (let bar = 0; bar < BARS; bar++) {
    const phraseIdx = Math.floor(bar / PHRASE);
    const barInPhrase = bar % PHRASE;
    const isBSection = phraseIdx === 2;
    const sectionId = phraseIdx === 3 ? 0 : phraseIdx;
    const center = phraseCenters[phraseIdx];
    const regOffset = phraseArcOffset(phraseIdx);
    const barStartBeats = bar * 4;
    const isCadenceBar = barInPhrase === 3;

    const chordTones = chordToneDegreesForBar(barInPhrase, progId, isBSection);
    melodyNotesThisBar.length = 0;

    if (isCadenceBar) {
      const approach = cadenceIdx % 2 === 0 ? [2, 7] : [4, 7];
      melodyNotesThisBar.push({ pos16: 4, degree: approach[0], dur16: 2 });
      melodyNotesThisBar.push({ pos16: 10, degree: approach[1], dur16: 2 });
      melodyNotesThisBar.push({ pos16: 14, degree: 0, dur16: 2 });
    } else {
      const cellFirst = motifCell;
      const cellSecond = sectionId === 1 ? applyAPrimeTransform(motifCell, bar) : motifCell;
      for (const n of cellFirst) {
        if (n.degree < 0 || n.dur16 <= 0) continue;
        melodyNotesThisBar.push({ pos16: n.pos16, degree: n.degree, dur16: n.dur16 });
      }
      for (const n of cellSecond) {
        if (n.degree < 0 || n.dur16 <= 0) continue;
        melodyNotesThisBar.push({ pos16: n.pos16 + 8, degree: n.degree, dur16: n.dur16 });
      }
      if (isBSection && barInPhrase === 1 && biasedArc > 0.5 && !usedBLeap) {
        const peak = Math.min(7, melodyNotesThisBar.length - 1);
        if (peak >= 0 && melodyNotesThisBar[peak]) {
          melodyNotesThisBar[peak].degree = 4;
          usedBLeap = true;
        }
      }
    }

    if (melodyNotesThisBar.length > maxNotesPerBar) {
      melodyNotesThisBar.length = maxNotesPerBar;
    }

    const firstNoteOfPhrase = barInPhrase === 0 && bar > 0;
    for (let i = 0; i < melodyNotesThisBar.length; i++) {
      const { pos16, degree, dur16 } = melodyNotesThisBar[i];
      const tBeats = barStartBeats + (pos16 / 16) * 4;
      const durBeats = (dur16 / 16) * 4;
      const isStrongBeat = pos16 % 8 === 0;
      let deg = degree;
      if (isStrongBeat) {
        deg = snapToChordTone(deg, chordTones);
      }
      if (lastMelodyPitch !== null) {
        const allowLeap = isBSection && biasedArc > 0.6 && !usedBLeap && i === melodyNotesThisBar.length - 1;
        const maxInterval = firstNoteOfPhrase ? 8 : allowLeap ? 8 : MAX_INTERVAL_SEMI;
        deg = stepwiseNextDegree(deg, lastMelodyPitch, center + regOffset, maxInterval);
        if (allowLeap && maxInterval > MAX_INTERVAL_SEMI) usedBLeap = true;
      }
      const semi = degreeToSemitone(deg);
      let pitch = Math.max(24, Math.min(96, center + regOffset + semi));
      if (isCadenceBar && i === melodyNotesThisBar.length - 1) {
        pitch = cadencePitch;
      }
      lastMelodyPitch = pitch;
      push(tBeats, Math.max(0.25, durBeats), pitch, 0.7 + 0.1 * (i % 2), "melody");
    }
  }

  for (let bar = 0; bar < BARS; bar++) {
    const barInPhrase = bar % PHRASE;
    const isBSection = Math.floor(bar / PHRASE) === 2;
    const { root } = chordForBar(barInPhrase, progId, isBSection);
    const barStart = bar * 4;
    const bassRoot = root - 24;
    push(barStart + 0, 2, bassRoot, 0.7, "bass");
    push(barStart + 2, 2, bassRoot + 7, 0.65, "bass");
  }

  for (let bar = 0; bar < BARS; bar++) {
    const barInPhrase = bar % PHRASE;
    const isBSection = Math.floor(bar / PHRASE) === 2;
    const { triad } = chordForBar(barInPhrase, progId, isBSection);
    const barStart = bar * 4;
    for (const p of triad) push(barStart, 4, p, 0.5, "harmony");
  }

  for (let bar = 0; bar < BARS; bar++) {
    const barStart = bar * 4;
    push(barStart + 0, 0.25, 36, 0.8, "rhythm");
    push(barStart + 2, 0.25, 36, 0.7, "rhythm");
    push(barStart + 1, 0.25, 42, 0.4, "rhythm");
    push(barStart + 3, 0.25, 42, 0.4, "rhythm");
  }

  events.sort((a, b) => a.t0 - b.t0 || a.channel.localeCompare(b.channel) || a.pitch - b.pitch);

  const duration = Math.min(DUR_SEC, totalBeats * secondsPerBeat);
  const id = planIdFrom(
    guidance?.seed,
    bpm,
    baseCenter,
    motifIdx,
    cadenceIdx,
    phraseCenters
  );

  return {
    id,
    featureHash: "v6",
    durationSec: duration,
    bpm,
    key: "A minor",
    events,
  };
}
