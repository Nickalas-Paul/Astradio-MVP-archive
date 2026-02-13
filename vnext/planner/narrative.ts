// vnext/planner/narrative.ts
import { Plan, EventToken } from "../contracts";
import type { ElementBlend, MotionProfile, NarrativeArc } from "../astro/guidance";
import type { PersonalityProfileV1 } from "../astro/personality-profile";
import { selectChordProgression, selectBasslinePattern, selectHookMotif } from "./libraries";
import { selectTransformationSequence, applyTransformationSequence } from "./transformations";

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

function chordToneDegreesForBar(
  barInPhrase: number,
  bar: number,
  chordProgression: ReturnType<typeof selectChordProgression>,
  isBSection: boolean
): number[] {
  const progBars = chordProgression.bars;
  const barIndex = isBSection ? (barInPhrase + 4) % progBars : barInPhrase;
  const actualBarIndex = barIndex % chordProgression.roots.length;
  
  const root = chordProgression.roots[actualBarIndex];
  const triadShape = chordProgression.triads[actualBarIndex] ?? [0, 3, 7];
  
  // Convert triad semitones to scale degrees (simplified: assume natural minor)
  // Root = 0, third = 2 or 3, fifth = 4
  const degrees = [0]; // Root
  if (triadShape[1] === 3) degrees.push(2); // Minor third
  else if (triadShape[1] === 4) degrees.push(3); // Major third
  if (triadShape[2] === 7) degrees.push(4); // Perfect fifth
  
  return degrees.length > 0 ? degrees : [0, 2, 4];
}

function chordForBar(
  barInPhrase: number,
  bar: number,
  chordProgression: ReturnType<typeof selectChordProgression>,
  isBSection: boolean
): { root: number; triad: [number, number, number]; extensions?: number[] } {
  // Handle 4-bar vs 8-bar progressions
  const progBars = chordProgression.bars;
  const barIndex = isBSection ? (barInPhrase + 4) % progBars : barInPhrase;
  const actualBarIndex = barIndex % chordProgression.roots.length;
  
  const root = chordProgression.roots[actualBarIndex];
  const triadShape = chordProgression.triads[actualBarIndex] ?? [0, 3, 7];
  const extensions = chordProgression.extensions?.[actualBarIndex];
  
  return {
    root,
    triad: [root + triadShape[0], root + triadShape[1], root + triadShape[2]] as [number, number, number],
    extensions,
  };
}

/** Deterministic harmonic rhythm: onset offset in beats (0, 1.5, or 2) to avoid every chord on downbeat. */
function harmonicOnsetBeats(phase: 0 | 1 | 2, barInPhrase: number, bar: number, seedNum: number): number {
  if (phase === 0) return 0;
  if (phase === 1) return (seedNum + bar) % 2 === 0 ? 0 : 1.5;
  return barInPhrase === 3 ? 2 : 0;
}

/** One bar per phrase in Encounter gets a mid-bar color morph (add 7th); deterministic. */
function colorMorphThisBar(phase: 0 | 1 | 2, barInPhrase: number, bar: number, seedNum: number): boolean {
  return phase === 0 && barInPhrase === 1 && (seedNum + bar) % 2 === 0;
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

/** Harmonic field: prefer root position in Encounter and Integration when gravity/centeredness high. */
function preferRootPosition(
  phase: 0 | 1 | 2,
  gravity: number,
  personality?: PersonalityProfileV1
): boolean {
  const coreGravity = personality
    ? clamp01((gravity + personality.temperament.gravity + personality.subsystems.saturn.restraint) / 3)
    : gravity;
  if (phase === 0) return true;
  if (phase === 2 && coreGravity >= 0.4) return true;
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
    personality?: PersonalityProfileV1;
    genre?: string; // Genre scaffolding: "house" | "classical" | "jazz" | "ambient" | "electronic"
  }
): Plan {
  const [vTempo, vBright, vDense, vArc, vMotif, vCad] = v;

  const tempoBias = guidance?.tempoBias ?? 0;
  const arcBias = guidance?.arcBias ?? 0;
  const densityBias = guidance?.densityBias ?? 0;
  const motionProfile = guidance?.motionProfile;
  const elementBlend = guidance?.elementBlend;
  const personality = guidance?.personality;
  const gravity = motionProfile?.gravity ?? 0.5;
  const flow = motionProfile?.flow ?? 0.5;
  const articulation = motionProfile?.articulation ?? 0.5;
  const shimmer = motionProfile?.shimmer ?? 0.5;
  const venusSoftness = personality?.subsystems.venus.softness ?? 0.5;
  const moonPermeability = personality?.subsystems.moon.permeability ?? 0.5;
  const marsPropulsion = personality?.subsystems.mars.propulsion ?? 0.5;
  const marsEdge = personality?.subsystems.mars.edge ?? 0.5;
  const mercuryAgility = personality?.subsystems.mercury.agility ?? 0.5;
  const plutoDepth = personality?.subsystems.outers.plutoDepth ?? 0;
  const revealEncounter = personality?.reveal.encounter ?? { core: 0.7, inner: 0.2, style: 0.1 };
  const revealRecognition = personality?.reveal.recognition ?? { core: 0.45, inner: 0.3, style: 0.25 };
  const seedNum = (guidance?.seed ?? "v6").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const genre = guidance?.genre || 'house';

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

  const seed = guidance?.seed ?? "v6";
  const cadenceIdx = guidance?.cadenceIdx !== undefined ? guidance.cadenceIdx : Math.floor(clamp01(vCad) * CADENCE_ENDS.length);
  const cadencePitch = CADENCE_ENDS[cadenceIdx % CADENCE_ENDS.length];

  const biasedDensity = clamp01(vDense + 0.2 * densityBias);
  const density = lerp(0.3, 0.9, biasedDensity);
  
  // Select from expanded libraries
  const aspectTension = (elementBlend?.fire ?? 0.25) + (elementBlend?.air ?? 0.25); // Approximate tension from elements
  const moonPhase = personality?.subsystems.moon.permeability ?? 0.5;
  const clusterDensity = density;
  const dominantPlanet = (personality?.subsystems.sun?.presence ?? 0.5) > 0.5 ? 'sun' : 'moon'; // Simplified
  
  const chordProgression = selectChordProgression(seed, elementBlend, aspectTension, moonPhase);
  const bassPattern = selectBasslinePattern(seed, genre, motionProfile);
  const hookMotif = selectHookMotif(seed, clusterDensity, dominantPlanet, baseCenter);
  
  // Select transformation sequence
  const transformationSequence = selectTransformationSequence(seed, elementBlend, mercuryAgility);
  
  // Apply transformations to base hook
  const baseHookRaw = hookMotif.notes.map(n => ({ ...n }));
  const transformedHook = applyTransformationSequence(baseHookRaw, transformationSequence, seed, 'hook_base', density);
  
  // Store debug IDs
  const debugIds = {
    progressionId: chordProgression.id,
    motifId: hookMotif.id,
    bassPatternId: bassPattern.id,
    transformationSequence: transformationSequence,
  };

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

    // Apply A/A'/B/A structure with transformations
    let hook: Hook;
    if (genre === 'house') {
      // House: A A' B A form
      if (isCadenceBar) {
        hook = makeCadenceVersion(transformedHook, cadenceIdx, isBSection);
      } else if (phraseIdx === 1) {
        // A': Apply one additional transformation
        const aPrimeTransform = transformationSequence[0] ?? 'rhythmic_shift';
        hook = applyTransformationSequence(transformedHook, [aPrimeTransform], seed, 'hook_aprime_' + bar, density * 0.5);
      } else if (phraseIdx === 2) {
        // B: Contrast (different register or motif family)
        const contrastHook = selectHookMotif(seed + '_b', clusterDensity * 0.7, dominantPlanet, center + 3);
        hook = contrastHook.notes.map(n => ({ ...n }));
      } else {
        // A: Return to base
        hook = transformedHook.map(n => ({ ...n }));
      }
    } else {
      // Default behavior: use transformed hook with variations
      if (isCadenceBar) {
        hook = makeCadenceVersion(transformedHook, cadenceIdx, isBSection);
      } else if (sectionId === 1) {
        const ornamentDensity = clamp01(density + (mercuryAgility - 0.5) * 0.15);
        hook = applyTransformationSequence(transformedHook, ['ornament'], seed, 'hook_orn_' + bar, ornamentDensity);
      } else if (isBSection) {
        hook = applyTransformationSequence(transformedHook, ['transpose'], seed, 'hook_b_' + bar, 0.5);
        if (barInPhrase === 1 && biasedArc > 0.5 && !usedBLeap && hook.length > 2) {
          hook[hook.length - 1].degree = 4;
          usedBLeap = true;
        }
      } else {
        hook = transformedHook.map(n => ({ ...n }));
      }
    }

    const chordTones = chordToneDegreesForBar(barInPhrase, bar, chordProgression, isBSection);
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
      const semi = semitoneForDegree(deg, barInPhrase, isCadenceBar, i, notes.length, chordProgression.id % 2, isBSection);
      let pitch = Math.max(24, Math.min(96, center + regOffset + semi));
      if (isCadenceBar && i === notes.length - 1) pitch = cadencePitch;
      lastMelodyPitch = pitch;
      let effectiveDur = durBeats * (0.85 + 0.15 * flow) * (1.05 - 0.15 * articulation);
      const phase = narrativePhaseForBar(bar);
      const allowLongSustain = phase === 2 && isEarthDominant(elementBlend);
      const capSec = allowLongSustain ? MAX_MELODY_SUSTAIN_SEC_INTEGRATION_EARTH : MAX_MELODY_SUSTAIN_SEC;
      const capBeats = capSec / secondsPerBeat;
      if (effectiveDur > capBeats) effectiveDur = capBeats;
      const melodyVel = clamp01(0.7 + 0.1 * (i % 2) + 0.05 * marsEdge);
      push(tBeats, Math.max(0.25, effectiveDur), pitch, melodyVel, "melody");
    }
  }

  const barsPerPhase = [ENCOUNTER_BARS, RECOGNITION_BARS, BARS - ENCOUNTER_BARS - RECOGNITION_BARS];
  const minEncounter = Math.max(6, Math.floor(8 * (0.85 + 0.15 * (1 - revealEncounter.core))));
  const minPerPhase: [number, number, number] = [minEncounter, MIN_MELODY_PER_PHASE[1], MIN_MELODY_PER_PHASE[2]];
  const melodySoFar = events.filter(e => e.channel === "melody");
  const phaseCounts: [number, number, number] = [0, 0, 0];
  for (const e of melodySoFar) {
    const bar = Math.floor(e.t0 / (4 * secondsPerBeat));
    const phase = narrativePhaseForBar(bar);
    phaseCounts[phase]++;
  }
  // Melody filler: house reduces wandering fills, prefers motif repetition
  const FILLER_DUR_BEATS = [0.25, 0.5, 0.75] as const;
  const reduceFillerForHouse = genre === 'house';
  for (let phase = 0; phase < 3; phase++) {
    const need = minPerPhase[phase] - phaseCounts[phase];
    if (need <= 0) continue;
    // House: reduce filler in Recognition (phase 1) to emphasize motif
    const adjustedNeed = reduceFillerForHouse && phase === 1 ? Math.max(0, Math.floor(need * 0.7)) : need;
    if (adjustedNeed <= 0) continue;
    const firstBar = phase === 0 ? 0 : phase === 1 ? ENCOUNTER_BARS : ENCOUNTER_BARS + RECOGNITION_BARS;
    const numBars = barsPerPhase[phase];
    for (let i = 0; i < adjustedNeed; i++) {
      const bar = firstBar + (seedNum + i) % numBars;
      const barInPhrase = bar % PHRASE;
      const isCadenceBar = barInPhrase === 3;
      const beat = isCadenceBar ? (seedNum + i) % 2 : (seedNum + i * 7) % 4;
      const tBeats = bar * 4 + beat;
      const phraseIdx = Math.floor(bar / PHRASE);
      const isBSection = phraseIdx === 2;
      const center = phraseCenters[phraseIdx];
      const chordTones = chordToneDegreesForBar(barInPhrase, bar, chordProgression, isBSection);
      const degree = chordTones[(seedNum + i) % chordTones.length] ?? chordTones[0] ?? 0;
      const semi = degreeToSemitone(degree);
      const pitch = Math.max(24, Math.min(96, center + semi));
      const durIdx = (seedNum + i * 3) % FILLER_DUR_BEATS.length;
      const durBeats = FILLER_DUR_BEATS[durIdx];
      push(tBeats, durBeats, pitch, 0.55 + 0.1 * (i % 2), "melody");
    }
  }

  // Bass: use selected bassline pattern
  for (let bar = 0; bar < BARS; bar++) {
    const barInPhrase = bar % PHRASE;
    const isBSection = Math.floor(bar / PHRASE) === 2;
    const { root } = chordForBar(barInPhrase, bar, chordProgression, isBSection);
    const barStart = bar * 4;
    const bassRoot = root - 24;
    
    // Apply bassline pattern (pattern repeats every patternBars bars)
    const patternBars = bassPattern.bars;
    const patternBarIndex = bar % patternBars;
    
    // Get events for this bar in the pattern
    const patternEvents = bassPattern.events.filter(e => {
      const eventBar = Math.floor(e.beat / 4);
      return eventBar === patternBarIndex;
    });
    
    // If no events for this bar, use root on downbeat as fallback
    if (patternEvents.length === 0) {
      push(barStart + 0, 2, bassRoot, 0.7, "bass");
    } else {
      for (const event of patternEvents) {
        const beatInBar = event.beat % 4;
        const degree = event.degree;
        const semi = degreeToSemitone(degree);
        const pitch = Math.max(24, Math.min(72, bassRoot + semi));
        push(barStart + beatInBar, event.durBeats, pitch, event.velocity, "bass");
      }
    }
  }

  // Harmony with deterministic inversion selection + less-grid harmonic rhythm (onset offsets, color morph).
  const HARMONY_LO = 48;
  const HARMONY_HI = 76;
  const MINOR_7TH_SEMI = 10;
  let prevHarmonyPitches: [number, number, number] | null = null;
  for (let bar = 0; bar < BARS; bar++) {
    const barInPhrase = bar % PHRASE;
    const isBSection = Math.floor(bar / PHRASE) === 2;
    const { root, triad, extensions } = chordForBar(barInPhrase, bar, chordProgression, isBSection);
    const [a, b, c] = triad.slice().sort((x, y) => x - y);
    const rootPos: [number, number, number] = [a, b, c];
    const firstInv: [number, number, number] = [b, c, a + 12];
    const secondInv: [number, number, number] = [c, a + 12, b + 12];
    const clamp = (p: [number, number, number]) => p.map(x => Math.max(HARMONY_LO, Math.min(HARMONY_HI, x))) as [number, number, number];
    const candidates = [clamp(rootPos), clamp(firstInv), clamp(secondInv)];
    const phase = narrativePhaseForBar(bar);
    const preferRoot = preferRootPosition(phase, gravity, personality);
    const rootPenalty = preferRoot ? (1 - venusSoftness) * 20 : 0;
    let best = candidates[0];
    if (prevHarmonyPitches !== null) {
      let bestCost = 1e9;
      for (let idx = 0; idx < candidates.length; idx++) {
        const cand = candidates[idx];
        let cost = Math.abs(cand[0] - prevHarmonyPitches[0]) + Math.abs(cand[1] - prevHarmonyPitches[1]) + Math.abs(cand[2] - prevHarmonyPitches[2]);
        if (idx !== 0) cost += rootPenalty;
        if (cost < bestCost) { bestCost = cost; best = cand; }
      }
    } else if (preferRoot) {
      best = candidates[0];
    }
    prevHarmonyPitches = best;
    const barStart = bar * 4;
    const onsetBeats = harmonicOnsetBeats(phase, barInPhrase, bar, seedNum);
    const t0Beats = barStart + onsetBeats;
    for (const p of best) push(t0Beats, 4, p, 0.5, "harmony");
    
    // Add extensions if defined in progression
    if (extensions && extensions.length > 0) {
      for (const ext of extensions) {
        const extPitch = Math.max(HARMONY_LO, Math.min(HARMONY_HI, root + ext));
        push(barStart + 2, 2, extPitch, 0.42, "harmony");
      }
    } else if (colorMorphThisBar(phase, barInPhrase, bar, seedNum)) {
      const seventhPitch = Math.max(HARMONY_LO, Math.min(HARMONY_HI, root + MINOR_7TH_SEMI));
      push(barStart + 2, 2, seventhPitch, 0.42, "harmony");
    }
    
    // House: chord stabs (short harmony events) on offbeats in Recognition phase
    if (genre === 'house' && phase === 1 && barInPhrase % 2 === 0) {
      const stabBeat = barStart + 1.5 + (seedNum + bar) % 2 * 1.0; // 1.5 or 2.5
      const stabPitch = best[1]; // Middle voice
      push(stabBeat, 0.25, stabPitch, 0.45, "harmony");
    }
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
  const blendFactor = clamp01(
    flow * 0.4 + (water + air) * 0.3 - fire * 0.25 + earth * 0.2 + moonPermeability * 0.2 + venusSoftness * 0.2
  );
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

  // Rhythm: house idioms when genre === 'house', else default
  if (genre === 'house') {
    // House: 4-on-the-floor kick + hats on offbeats + clap on 2&4
    for (let bar = 0; bar < BARS; bar++) {
      const barStart = bar * 4;
      const phase = narrativePhaseForBar(bar);
      const activation = personality?.temperament.activation ?? 0.5;
      const useHalfTime = activation < 0.4; // Lower activation = half-time feel
      
      // Kick: 4-on-the-floor (beats 0,1,2,3) or half-time (0,2)
      if (useHalfTime) {
        push(barStart + 0, 0.25, 36, 0.85, "rhythm");
        push(barStart + 2, 0.25, 36, 0.75, "rhythm");
      } else {
        push(barStart + 0, 0.25, 36, 0.85, "rhythm");
        push(barStart + 1, 0.25, 36, 0.80, "rhythm");
        push(barStart + 2, 0.25, 36, 0.80, "rhythm");
        push(barStart + 3, 0.25, 36, 0.75, "rhythm");
      }
      
      // Hats on offbeats (0.5, 1.5, 2.5, 3.5) with lower velocity
      const hatVel = 0.35 + (seedNum + bar) % 2 * 0.05; // Slight variation
      push(barStart + 0.5, 0.25, 42, hatVel, "rhythm");
      push(barStart + 1.5, 0.25, 42, hatVel, "rhythm");
      push(barStart + 2.5, 0.25, 42, hatVel, "rhythm");
      push(barStart + 3.5, 0.25, 42, hatVel, "rhythm");
      
      // Clap/snare on beats 1 and 3 (2 and 4 in musical counting)
      push(barStart + 1, 0.25, 38, 0.65, "rhythm");
      push(barStart + 3, 0.25, 38, 0.60, "rhythm");
      
      // Occasional ghost hat (seeded, deterministic)
      if ((seedNum + bar * 7) % 5 === 0 && phase === 1) {
        const ghostBeat = barStart + 0.25 + ((seedNum + bar) % 2) * 0.5;
        push(ghostBeat, 0.15, 42, 0.20, "rhythm");
      }
    }
  } else {
    // Default rhythm (existing behavior)
    for (let bar = 0; bar < BARS; bar++) {
      const barStart = bar * 4;
      const barInPhraseR = bar % PHRASE;
      const isCadenceBar = barInPhraseR === 3;
      const rhythmDensityThreshold = 0.5 + 0.1 * (1 - marsPropulsion);
      const omitBeat3Kick = !isCadenceBar && density < 0.65 && bar % 2 === 1;
      push(barStart + 0, 0.25, 36, 0.8, "rhythm");
      if (!omitBeat3Kick) push(barStart + 2, 0.25, 36, 0.7, "rhythm");
      push(barStart + 1, 0.25, 42, 0.4, "rhythm");
      push(barStart + 3, 0.25, 42, 0.4, "rhythm");
      if (barInPhraseR === 2 && density > rhythmDensityThreshold) {
        push(barStart + 0.5, 0.25, 42, 0.35, "rhythm");
        push(barStart + 2.5, 0.25, 42, 0.35, "rhythm");
      }
    }
  }

  events.sort((a, b) => a.t0 - b.t0 || a.channel.localeCompare(b.channel) || a.pitch - b.pitch);

  if (process.env.VNEXT_DEBUG_CHORD === "1") {
    const sustainedDurThreshold = 6 * one16thSec;
    for (let bar = 0; bar < BARS; bar++) {
      const barInPhrase = bar % PHRASE;
      const isBSection = Math.floor(bar / PHRASE) === 2;
      const { root, triad } = chordForBar(barInPhrase, bar, chordProgression, isBSection);
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
  const id = planIdFrom(guidance?.seed, bpm, baseCenter, hookMotif.id, cadenceIdx, phraseCenters);

  return {
    id,
    featureHash: "v6",
    durationSec: duration,
    bpm,
    key: "A minor",
    events,
    debug: debugIds,
  };
}
