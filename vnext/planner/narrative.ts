// vnext/planner/narrative.ts
import { Plan, EventToken } from "../contracts";
import type { ElementBlend, MotionProfile, NarrativeArc } from "../astro/guidance";

/**
 * Songwriting-focused planner: hummable hook, motif-derived cadence, reduced 1-3 stack.
 * - 1-bar HOOK_TEMPLATES with breath (sustained note + rest gaps); A A' B A form.
 * - Chord-tone targeting only on long notes / phrase endpoints; bass/drums decoupled from melody accents.
 * - Sonic Mirror: harmony = identity carrier, melody = motion inside harmony; 60s Encounter/Recognition/Integration.
 * - Deterministic: same (v, guidance) => identical Plan.events. No Date.now / Math.random.
 */

type V6 = [number, number, number, number, number, number];

/** Narrative phase: 0=Encounter (0–15s), 1=Recognition (15–45s), 2=Integration (45–60s). Bar-based. */
const ENCOUNTER_BARS = 4;
const RECOGNITION_BARS = 8;
function narrativePhaseForBar(bar: number): 0 | 1 | 2 {
  if (bar < ENCOUNTER_BARS) return 0;
  if (bar < ENCOUNTER_BARS + RECOGNITION_BARS) return 1;
  return 2;
}

const MIN_MELODY_PER_PHASE = [8, 12, 8] as const;
const MAX_MELODY_SUSTAIN_SEC = 2.5;
const MAX_MELODY_SUSTAIN_SEC_INTEGRATION_EARTH = 4;

const GRID_16 = 4;
const BARS = 16;
const PHRASE = 4;
const DUR_SEC = 60;
const MAX_MELODY_NOTES_PER_BAR = 6;
const MAX_INTERVAL_SEMI = 5;

/** Natural minor: 0=A,1=B,2=C,3=D,4=E,5=F,6=G,7=G(nat) default. Use leading-tone G#(11) only over V or cadence approach. */
const NATURAL_MINOR_SEMI: number[] = [0, 2, 3, 5, 7, 8, 10, 10];
const LEADING_TONE_SEMI = 11;
const CADENCE_ENDS = [71, 72, 74, 76];

/** One-bar hook: pos16 0–15, degree -1 = rest (no note). At least one dur16 >= 6 (breath). */
type HookNote = { pos16: number; degree: number; dur16: number };
type Hook = HookNote[];

const HOOK_TEMPLATES: Hook[] = [
  [{ pos16: 0, degree: 0, dur16: 8 }, { pos16: 8, degree: 2, dur16: 2 }, { pos16: 10, degree: 3, dur16: 2 }, { pos16: 12, degree: 2, dur16: 2 }, { pos16: 14, degree: 0, dur16: 2 }],
  [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 2, dur16: 2 }, { pos16: 6, degree: 3, dur16: 2 }, { pos16: 10, degree: 2, dur16: 2 }, { pos16: 12, degree: 0, dur16: 6 }],
  [{ pos16: 0, degree: 2, dur16: 6 }, { pos16: 6, degree: 3, dur16: 2 }, { pos16: 8, degree: 5, dur16: 2 }, { pos16: 10, degree: 3, dur16: 2 }, { pos16: 12, degree: 2, dur16: 2 }, { pos16: 14, degree: 0, dur16: 2 }],
  [{ pos16: 0, degree: 0, dur16: 6 }, { pos16: 6, degree: 1, dur16: 2 }, { pos16: 8, degree: 2, dur16: 2 }, { pos16: 12, degree: 0, dur16: 4 }],
  [{ pos16: 0, degree: 4, dur16: 4 }, { pos16: 4, degree: 3, dur16: 2 }, { pos16: 8, degree: 2, dur16: 4 }, { pos16: 12, degree: 0, dur16: 4 }],
  [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 2, dur16: 4 }, { pos16: 10, degree: 1, dur16: 2 }, { pos16: 12, degree: 0, dur16: 4 }],
];

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

/** Chord tones per bar (scale degrees). V = 7,2,4; VII/III/VI use natural minor (no 7). */
const CHORD_TONE_DEGREES: number[][] = [
  [0, 2, 4], [6, 1, 3], [7, 2, 4], [0, 2, 4],
  [0, 2, 4], [3, 5, 0], [7, 2, 4], [0, 2, 4],
  [6, 1, 3], [2, 4, 6], [6, 1, 3], [0, 2, 4],
];

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

function chordToneDegreesForBar(barInPhrase: number, progId: number, isBSection: boolean): number[] {
  const idx = (isBSection ? 2 : progId) * 4 + barInPhrase;
  return CHORD_TONE_DEGREES[idx] ?? [0, 2, 4];
}

function chordForBar(barInPhrase: number, progId: number, isBSection: boolean): { root: number; triad: [number, number, number] } {
  const roots = PROG_ROOTS[isBSection ? 2 : progId];
  const r = roots[barInPhrase];
  const shapes: [number, number, number][] = [PROG_TRIADS[0], PROG_TRIADS[1], PROG_TRIADS[2], PROG_TRIADS[3]];
  const shape = !isBSection
    ? (barInPhrase === 1 && progId === 1 ? PROG_IV_TRIAD : shapes[barInPhrase])
    : (barInPhrase === 0 ? shapes[0] : barInPhrase === 1 ? PROG_III_TRIAD : barInPhrase === 2 ? PROG_VII_TRIAD : shapes[3]);
  return { root: r, triad: [r + shape[0], r + shape[1], r + shape[2]] };
}

/** Natural minor scale pitch classes (semitones above root). */
const NATURAL_MINOR_PC = new Set([0, 2, 3, 5, 7, 8, 10]);

/** True if pitch (MIDI) is in the natural minor scale of the given root (MIDI). */
function isPitchInNaturalMinor(pitch: number, root: number): boolean {
  const pc = ((pitch - root) % 12 + 12) % 12;
  return NATURAL_MINOR_PC.has(pc);
}

function phraseArcOffset(phraseIdx: number): number {
  return [-2, 0, 3, 0][phraseIdx];
}

/** Natural minor default. */
function degreeToSemitone(degree: number): number {
  const d = ((degree % 8) + 8) % 8;
  return NATURAL_MINOR_SEMI[d] ?? 0;
}

/** Contextual leading tone: G#(11) only over V or in cadence approach into i; else G(10). Deterministic. */
function semitoneForDegree(
  degree: number,
  barInPhrase: number,
  isCadenceBar: boolean,
  noteIndex: number,
  notesLength: number,
  progId: number,
  isBSection: boolean
): number {
  const d = ((degree % 8) + 8) % 8;
  if (d !== 7) return NATURAL_MINOR_SEMI[d] ?? 0;
  const chordIsV = barInPhrase === 2 && !isBSection;
  const cadenceApproach = isCadenceBar && noteIndex >= notesLength - 2;
  const useLeadingTone = chordIsV || cadenceApproach;
  return useLeadingTone ? LEADING_TONE_SEMI : 10;
}

function nearestChordTone(degree: number, chordTones: number[]): number {
  let best = chordTones[0];
  let bestDist = 99;
  for (const c of chordTones) {
    let dist = Math.abs(degree - c);
    if (dist > 4) dist = 8 - dist;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

/** Cadence version: approach into tonic. Over V/i use 2→7→0 or 4→7→0; for B (no V) can use 2→6→0 to avoid G#. */
function makeCadenceVersion(hook: Hook, cadenceIdx: number, isBSection: boolean): Hook {
  const out = hook.map(n => ({ ...n }));
  const useNaturalApproach = isBSection && cadenceIdx % 2 === 0;
  const approach = useNaturalApproach ? [2, 6, 0] : (cadenceIdx % 2 === 0 ? [2, 7, 0] : [4, 7, 0]);
  const n = out.length;
  if (n >= 3) {
    out[n - 3].degree = approach[0];
    out[n - 2].degree = approach[1];
    out[n - 1].degree = approach[2];
  } else if (n >= 2) {
    out[n - 2].degree = approach[1];
    out[n - 1].degree = approach[2];
  } else if (n >= 1) {
    out[n - 1].degree = approach[2];
  }
  return out;
}

/** One small ornament for A': either one passing tone between two steps or one note shifted +1 pos16. Deterministic from bar. */
function applyAPrimeOrnament(hook: Hook, bar: number, density: number): Hook {
  if (density < 0.5) return hook.map(n => ({ ...n }));
  const out = hook.map(n => ({ ...n }));
  const idx = bar % Math.max(1, out.length - 1);
  const useShift = (bar + 1) % 2 === 0;
  if (useShift && out[idx].pos16 < 15) {
    out[idx].pos16 = Math.min(15, out[idx].pos16 + 1);
  } else if (!useShift && idx > 0 && idx < out.length) {
    const prev = out[idx - 1].degree;
    const next = out[idx].degree;
    const pass = prev <= next ? Math.min(7, prev + 1) : Math.max(0, prev - 1);
    out[idx].degree = pass;
  }
  return out;
}

/** B section: transpose degrees +2 (wrap 0..7), keep rhythm. */
function transposeHook(hook: Hook, delta: number): Hook {
  return hook.map(n => n.degree < 0 ? { ...n } : { ...n, degree: ((n.degree + delta) % 8 + 8) % 8 });
}

/** Stepwise clamp from previous pitch; uses natural minor for interval check. */
function stepwiseDegree(degree: number, prevPitch: number, center: number, maxInterval: number): number {
  const nextSemi = degreeToSemitone(degree);
  const nextPitch = center + nextSemi;
  if (Math.abs(nextPitch - prevPitch) <= maxInterval) return degree;
  const sign = nextPitch > prevPitch ? 1 : -1;
  const target = prevPitch + sign * maxInterval;
  const rel = target - center;
  for (let d = 0; d < 8; d++) {
    if (Math.abs(NATURAL_MINOR_SEMI[d] - rel) <= 2) return d;
  }
  return degree;
}

/** Prefer chord tone on long notes or phrase-end; sustained notes (dur16 >= 6) always chord tone to avoid dissonance. */
function resolveDegree(
  deg: number,
  chordTones: number[],
  isLongNote: boolean,
  isPhraseEndNote: boolean,
  hook: Hook,
  noteIndex: number
): number {
  const degNorm = ((deg % 8) + 8) % 8;
  const ct = chordTones.includes(degNorm);
  if (ct) return deg;
  if (isLongNote || isPhraseEndNote) return nearestChordTone(deg, chordTones);
  const nextPos = noteIndex + 1 < hook.length ? hook[noteIndex + 1].pos16 : 16;
  const gap = nextPos - (hook[noteIndex]?.pos16 ?? 0);
  if (gap <= 4) return deg;
  return nearestChordTone(deg, chordTones);
}

/** Harmonic field: prefer root position in Encounter and Integration when gravity high. */
function preferRootPosition(phase: 0 | 1 | 2, gravity: number): boolean {
  if (phase === 0) return true;
  if (phase === 2 && gravity >= 0.4) return true;
  return false;
}

function isEarthDominant(blend: ElementBlend | undefined): boolean {
  if (!blend) return false;
  const { earth, fire, air, water } = blend;
  return earth >= 0.3 && earth >= Math.max(fire, air, water);
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
    elementBlend?: ElementBlend;
    motionProfile?: MotionProfile;
    narrativeArc?: NarrativeArc;
  }
): Plan {
  const [vTempo, vBright, vDense, vArc, vMotif, vCad] = v;

  const tempoBias = guidance?.tempoBias ?? 0;
  const arcBias = guidance?.arcBias ?? 0;
  const densityBias = guidance?.densityBias ?? 0;
  const motionProfile = guidance?.motionProfile;
  const elementBlend = guidance?.elementBlend;
  const gravity = motionProfile?.gravity ?? 0.5;
  const flow = motionProfile?.flow ?? 0.5;
  const articulation = motionProfile?.articulation ?? 0.5;
  const shimmer = motionProfile?.shimmer ?? 0.5;

  const biasedTempo = clamp01(vTempo * (1 + 0.1 * tempoBias));
  const bpm = Math.round(lerp(70, 140, biasedTempo));
  const baseCenter = Math.round(lerp(55, 67, vBright));

  const biasedArc = clamp01(vArc * (1 + 0.3 * arcBias));
  const arcLift = lerp(3, 10, biasedArc);
  const registerBias = Math.round((shimmer - 0.5) * 2 - (gravity - 0.5) * 1);
  const phraseCenters = [
    baseCenter - Math.round(arcLift * 0.5) + registerBias,
    baseCenter + Math.round(arcLift * 0.4) + registerBias,
    baseCenter + Math.round(arcLift * 1.0) + registerBias,
    baseCenter - Math.round(arcLift * 0.2) + registerBias,
  ].map(c => Math.max(48, Math.min(72, c)));

  const motifIdx = guidance?.motifIdx !== undefined ? guidance.motifIdx : Math.floor(clamp01(vMotif) * HOOK_TEMPLATES.length);
  const cadenceIdx = guidance?.cadenceIdx !== undefined ? guidance.cadenceIdx : Math.floor(clamp01(vCad) * CADENCE_ENDS.length);
  const cadencePitch = CADENCE_ENDS[cadenceIdx % CADENCE_ENDS.length];

  const biasedDensity = clamp01(vDense + 0.2 * densityBias);
  const density = lerp(0.3, 0.9, biasedDensity);
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

  const baseHook = HOOK_TEMPLATES[motifIdx % HOOK_TEMPLATES.length].map(n => ({ ...n }));
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

    let hook: Hook;
    if (isCadenceBar) {
      hook = makeCadenceVersion(
        sectionId === 1 ? applyAPrimeOrnament(baseHook, bar, density) : isBSection ? transposeHook(baseHook, 2) : baseHook,
        cadenceIdx,
        isBSection
      );
    } else if (sectionId === 1) {
      hook = applyAPrimeOrnament(baseHook, bar, density);
    } else if (isBSection) {
      hook = transposeHook(baseHook, 2);
      if (barInPhrase === 1 && biasedArc > 0.5 && !usedBLeap && hook.length > 2) {
        hook[hook.length - 1].degree = 4;
        usedBLeap = true;
      }
    } else {
      hook = baseHook.map(n => ({ ...n }));
    }

    const chordTones = chordToneDegreesForBar(barInPhrase, progId, isBSection);
    const notes = hook.filter(n => n.degree >= 0 && n.dur16 > 0);
    if (notes.length > MAX_MELODY_NOTES_PER_BAR) notes.length = MAX_MELODY_NOTES_PER_BAR;

    const firstNoteOfPhrase = barInPhrase === 0 && bar > 0;
    for (let i = 0; i < notes.length; i++) {
      const { pos16, degree, dur16 } = notes[i];
      const tBeats = barStartBeats + (pos16 / 16) * 4;
      const durBeats = (dur16 / 16) * 4;
      const isLongNote = dur16 >= 6;
      const isPhraseEndNote = isCadenceBar && (i >= notes.length - 2);
      let deg = resolveDegree(degree, chordTones, isLongNote, isPhraseEndNote, notes, i);
      if (lastMelodyPitch !== null) {
        const allowLeap = isBSection && biasedArc > 0.6 && !usedBLeap && i === notes.length - 1;
        deg = stepwiseDegree(deg, lastMelodyPitch, center + regOffset, firstNoteOfPhrase ? 8 : allowLeap ? 8 : MAX_INTERVAL_SEMI);
        if (allowLeap) usedBLeap = true;
      }
      const semi = semitoneForDegree(deg, barInPhrase, isCadenceBar, i, notes.length, progId, isBSection);
      let pitch = Math.max(24, Math.min(96, center + regOffset + semi));
      if (isCadenceBar && i === notes.length - 1) pitch = cadencePitch;
      lastMelodyPitch = pitch;
      let effectiveDur = durBeats * (0.85 + 0.15 * flow) * (1.05 - 0.15 * articulation);
      const phase = narrativePhaseForBar(bar);
      const allowLongSustain = phase === 2 && isEarthDominant(elementBlend);
      const capSec = allowLongSustain ? MAX_MELODY_SUSTAIN_SEC_INTEGRATION_EARTH : MAX_MELODY_SUSTAIN_SEC;
      const capBeats = capSec / secondsPerBeat;
      if (effectiveDur > capBeats) effectiveDur = capBeats;
      push(tBeats, Math.max(0.25, effectiveDur), pitch, 0.7 + 0.1 * (i % 2), "melody");
    }
  }

  const barsPerPhase = [ENCOUNTER_BARS, RECOGNITION_BARS, BARS - ENCOUNTER_BARS - RECOGNITION_BARS];
  const melodySoFar = events.filter(e => e.channel === "melody");
  const phaseCounts: [number, number, number] = [0, 0, 0];
  for (const e of melodySoFar) {
    const bar = Math.floor(e.t0 / (4 * secondsPerBeat));
    const phase = narrativePhaseForBar(bar);
    phaseCounts[phase]++;
  }
  const seedNum = (guidance?.seed ?? "v6").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let phase = 0; phase < 3; phase++) {
    const need = MIN_MELODY_PER_PHASE[phase] - phaseCounts[phase];
    if (need <= 0) continue;
    const firstBar = phase === 0 ? 0 : phase === 1 ? ENCOUNTER_BARS : ENCOUNTER_BARS + RECOGNITION_BARS;
    const numBars = barsPerPhase[phase];
    for (let i = 0; i < need; i++) {
      const bar = firstBar + (seedNum + i) % numBars;
      const beat = (seedNum + i * 7) % 4;
      const tBeats = bar * 4 + beat;
      const phraseIdx = Math.floor(bar / PHRASE);
      const barInPhrase = bar % PHRASE;
      const isBSection = phraseIdx === 2;
      const center = phraseCenters[phraseIdx];
      const chordTones = chordToneDegreesForBar(barInPhrase, progId, isBSection);
      const degree = chordTones[0] ?? 0;
      const semi = degreeToSemitone(degree);
      const pitch = Math.max(24, Math.min(96, center + semi));
      push(tBeats, 0.25, pitch, 0.6, "melody");
    }
  }

  const bassPattern = (cadenceIdx + Math.floor(density * 2)) % 2;
  for (let bar = 0; bar < BARS; bar++) {
    const barInPhrase = bar % PHRASE;
    const isBSection = Math.floor(bar / PHRASE) === 2;
    const { root } = chordForBar(barInPhrase, progId, isBSection);
    const barStart = bar * 4;
    const bassRoot = root - 24;
    if (bassPattern === 0) {
      push(barStart + 0, 2, bassRoot, 0.7, "bass");
      push(barStart + 2, 2, bassRoot, 0.65, "bass");
    } else {
      push(barStart + 0, 3, bassRoot, 0.7, "bass");
      // Diatonic, chord-aware approach: no approach on cadence; only scale tones that don't clash with current chord.
      const isCadenceBar = barInPhrase === 3;
      const nextRoot = barInPhrase < 3 ? chordForBar(barInPhrase + 1, progId, isBSection).root - 24 : bassRoot;
      let approachPitch = nextRoot;
      if (!isCadenceBar) {
        const candWholeStep = nextRoot - 2;
        const candFifthBelow = nextRoot + 5;
        if (isPitchInNaturalMinor(candWholeStep, root) && candWholeStep >= 24 && candWholeStep <= 72) {
          approachPitch = candWholeStep;
        } else if (isPitchInNaturalMinor(candFifthBelow, root) && candFifthBelow >= 24 && candFifthBelow <= 72) {
          approachPitch = candFifthBelow;
        }
      }
      push(barStart + 3, 1, Math.max(24, Math.min(72, approachPitch)), 0.6, "bass");
    }
  }

  // Harmony with deterministic inversion selection: minimize voice-leading; prefer root in Encounter/Integration when gravity high.
  const HARMONY_LO = 48;
  const HARMONY_HI = 76;
  let prevHarmonyPitches: [number, number, number] | null = null;
  for (let bar = 0; bar < BARS; bar++) {
    const barInPhrase = bar % PHRASE;
    const isBSection = Math.floor(bar / PHRASE) === 2;
    const { triad } = chordForBar(barInPhrase, progId, isBSection);
    const [a, b, c] = triad.slice().sort((x, y) => x - y);
    const rootPos: [number, number, number] = [a, b, c];
    const firstInv: [number, number, number] = [b, c, a + 12];
    const secondInv: [number, number, number] = [c, a + 12, b + 12];
    const clamp = (p: [number, number, number]) => p.map(x => Math.max(HARMONY_LO, Math.min(HARMONY_HI, x))) as [number, number, number];
    const candidates = [clamp(rootPos), clamp(firstInv), clamp(secondInv)];
    const phase = narrativePhaseForBar(bar);
    const preferRoot = preferRootPosition(phase, gravity);
    let best = candidates[0];
    if (prevHarmonyPitches !== null) {
      let bestCost = 1e9;
      for (let idx = 0; idx < candidates.length; idx++) {
        const cand = candidates[idx];
        let cost = Math.abs(cand[0] - prevHarmonyPitches[0]) + Math.abs(cand[1] - prevHarmonyPitches[1]) + Math.abs(cand[2] - prevHarmonyPitches[2]);
        if (preferRoot && idx !== 0) cost += 20;
        if (cost < bestCost) { bestCost = cost; best = cand; }
      }
    } else if (preferRoot) {
      best = candidates[0];
    }
    prevHarmonyPitches = best;
    const barStart = bar * 4;
    for (const p of best) push(barStart, 4, p, 0.5, "harmony");
  }

  // Color-shift harmony blending: extend harmony t1 with overlap + voice stagger (deterministic from guidance).
  const barSec = 4 * secondsPerBeat;
  const durationSec = Math.min(DUR_SEC, totalBeats * secondsPerBeat);
  const HARMONY_OVERLAP_CAP_SEC = 0.35;
  const VOICE_STAGGER_SEC = 0.018;
  const water = elementBlend?.water ?? 0.25;
  const air = elementBlend?.air ?? 0.25;
  const fire = elementBlend?.fire ?? 0.25;
  const earth = elementBlend?.earth ?? 0.25;
  const blendFactor = clamp01(flow * 0.4 + (water + air) * 0.3 - fire * 0.25 + earth * 0.2);
  const overlapRatio = 0.05 + 0.07 * blendFactor;
  const overlapBaseSec = Math.min(barSec * overlapRatio, HARMONY_OVERLAP_CAP_SEC);
  const harmonyEvents = events.filter((e): e is EventToken => e.channel === "harmony");
  const byChordT0 = new Map<number, EventToken[]>();
  for (const ev of harmonyEvents) {
    const key = Math.round(ev.t0 * 1000);
    if (!byChordT0.has(key)) byChordT0.set(key, []);
    byChordT0.get(key)!.push(ev);
  }
  const chordStarts = Array.from(byChordT0.keys()).sort((a, b) => a - b);
  for (const key of chordStarts) {
    const chordT0 = key / 1000;
    const group = byChordT0.get(key)!;
    const sortedByPitch = group.slice().sort((a, b) => a.pitch - b.pitch);
    const nextChordT0 = chordT0 + barSec;
    const maxT1 = Math.min(nextChordT0 + barSec, durationSec);
    for (let voiceIndex = 0; voiceIndex < sortedByPitch.length; voiceIndex++) {
      const ev = sortedByPitch[voiceIndex];
      const nominalT1 = ev.t0 + barSec;
      const stagger = voiceIndex * VOICE_STAGGER_SEC;
      let newT1 = nominalT1 + overlapBaseSec - stagger;
      newT1 = Math.min(newT1, maxT1, durationSec);
      newT1 = Math.max(newT1, ev.t1);
      ev.t1 = quantizeTo16th(newT1, bpm);
    }
  }

  for (let bar = 0; bar < BARS; bar++) {
    const barStart = bar * 4;
    const barInPhraseR = bar % PHRASE;
    const isCadenceBar = barInPhraseR === 3;
    const omitBeat3Kick = !isCadenceBar && density < 0.65 && bar % 2 === 1;
    push(barStart + 0, 0.25, 36, 0.8, "rhythm");
    if (!omitBeat3Kick) push(barStart + 2, 0.25, 36, 0.7, "rhythm");
    push(barStart + 1, 0.25, 42, 0.4, "rhythm");
    push(barStart + 3, 0.25, 42, 0.4, "rhythm");
    if (barInPhraseR === 2 && density > 0.55) {
      push(barStart + 0.5, 0.25, 42, 0.35, "rhythm");
      push(barStart + 2.5, 0.25, 42, 0.35, "rhythm");
    }
  }

  events.sort((a, b) => a.t0 - b.t0 || a.channel.localeCompare(b.channel) || a.pitch - b.pitch);

  if (process.env.VNEXT_DEBUG_CHORD === "1") {
    const sustainedDurThreshold = 6 * one16thSec;
    for (let bar = 0; bar < BARS; bar++) {
      const barInPhrase = bar % PHRASE;
      const isBSection = Math.floor(bar / PHRASE) === 2;
      const { root, triad } = chordForBar(barInPhrase, progId, isBSection);
      const chordTonePC = new Set(triad.map(p => p % 12));
      const barStart = bar * 4 * secondsPerBeat;
      const barEnd = (bar + 1) * 4 * secondsPerBeat;
      const bassInBar = events.filter(e => e.channel === "bass" && e.t0 >= barStart - 0.01 && e.t0 < barEnd + 0.01).map(e => e.pitch);
      const melodyInBar = events.filter(e => e.channel === "melody" && e.t0 >= barStart - 0.01 && e.t0 < barEnd + 0.01);
      const sustainedNonCt = melodyInBar.filter(e => (e.t1 - e.t0) >= sustainedDurThreshold && !chordTonePC.has(e.pitch % 12));
      console.log(`[DEBUG_CHORD] bar=${bar} root=${root} triad=[${triad.join(",")}] bassPitches=[${bassInBar.join(",")}] sustainedNonChordTone=${sustainedNonCt.map(e => e.pitch).join(",") || "none"}`);
    }
  }

  const duration = Math.min(DUR_SEC, totalBeats * secondsPerBeat);
  const id = planIdFrom(guidance?.seed, bpm, baseCenter, motifIdx, cadenceIdx, phraseCenters);

  return {
    id,
    featureHash: "v6",
    durationSec: duration,
    bpm,
    key: "A minor",
    events,
  };
}
