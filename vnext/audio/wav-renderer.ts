/**
 * Minimal deterministic WAV renderer: plan + payload hash → 60s 16-bit PCM WAV.
 * Performance layer: humanization (velocity, ADSR, phrase breathing, micro-timing, pan)
 * Instrumentation layer v1: genre-keyed instrument palette, procedural synthesis (kick/hat/clap/bass/harmony/melody),
 * mix glue (pseudo-sidechain duck, per-channel EQ). Deterministic: same plan + hash ⇒ same WAV sha256.
 */

import * as crypto from 'crypto';

export interface RenderOptions {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  returnChannelStats?: boolean;
  returnFxRoutingStats?: boolean;
}

export interface ChannelStats {
  peak: number;
  rms: number;
}

export interface FxRoutingStats {
  bass_send_room: number;
  bass_send_plate: number;
  bass_send_delay: number;
  reverb_return_lowband_rms: number;
}

export interface RenderResult {
  buffer: Buffer;
  sha256: string;
  duration_ms: number;
  size_bytes: number;
  channelStats?: Record<string, ChannelStats>;
  fxRoutingStats?: FxRoutingStats;
}

const DURATION_SEC = 60;
const DEFAULT_SAMPLE_RATE = 44100;
const A440 = 440;

/** Performance Layer v2: 4 phrases over 16 bars. */
const PHRASE_BARS = 4;
const TOTAL_BARS = 16;

/** Channel role for rendering (matches EventToken.channel). */
type ChannelRole = 'melody' | 'harmony' | 'rhythm' | 'bass';

/** Rhythm pitch mapping (GM drums): kick=36, snare/clap=38, hi-hat=42 */
const PITCH_KICK = 36;
const PITCH_CLAP = 38;
const PITCH_HAT = 42;

/** Humanization on by default; set VNEXT_HUMANIZE=0 to use legacy flat render for debugging. */
const HUMANIZE_ENABLED = process.env.VNEXT_HUMANIZE !== '0';

/** Instrumentation layer on by default when humanize on. Set VNEXT_INSTRUMENTATION=0 to bypass. */
const INSTRUMENTATION_ENABLED = process.env.VNEXT_INSTRUMENTATION !== '0';

/** Debug: print peak, RMS, send amounts, reverb return stats when set. */
const INSTRUMENTATION_DEBUG = process.env.VNEXT_INSTRUMENTATION_DEBUG === '1';

/** FX send targets: ROOM (short), PLATE (longer), DELAY (optional). */
interface FXSendAmounts {
  room: { kick: number; hat: number; clap: number; bass: number; harmony: number; melody: number };
  plate: { kick: number; hat: number; clap: number; bass: number; harmony: number; melody: number };
  delay: { kick: number; hat: number; clap: number; bass: number; harmony: number; melody: number };
}

function getFXSendAmounts(genre: string, seed: string): FXSendAmounts {
  const g = (genre || 'house').toLowerCase();
  const f = (key: string, lo: number, hi: number) => lo + rand01(seed, `fx:${g}:${key}`) * (hi - lo);
  if (g === 'house') {
    return {
      room: { kick: 0, hat: 0, clap: f('room:clap', 0.28, 0.42), bass: 0, harmony: 0, melody: 0 },
      plate: { kick: 0, hat: 0, clap: 0, bass: 0, harmony: f('plate:harm', 0.08, 0.16), melody: f('plate:mel', 0.05, 0.11) },
      delay: { kick: 0, hat: 0, clap: 0, bass: 0, harmony: 0, melody: f('delay:mel', 0.03, 0.08) },
    };
  }
  return getFXSendAmounts('house', seed);
}

// --- A) Deterministic hash-based PRNG (no global state, stable across runs) ---

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

/** [0, 1) derived from seed + key. Deterministic, no Math.random. */
function rand01(seed: string, key: string): number {
  return hashU32(seed, key) / 0x100000000;
}

/** (-1, 1) derived from seed + key. */
function randSigned(seed: string, key: string): number {
  return rand01(seed, key) * 2 - 1;
}

/** Deterministic 0..1 from string seed (legacy fallback path). */
function seedFloat(seed: string, index: number): number {
  return rand01(seed, String(index));
}

// --- Instrumentation Layer v1: genre-keyed instrument palette ---

export interface InstrumentPalette {
  kick: { pitchDropMs: number; clickAmp: number; saturation: number };
  clap: { decayMs: number; roomReflectMs: number; filterQ: number };
  hat: { decayMs: number; highpassHz: number };
  bass: {
    /** Option A two-layer: sub anchor + mid character. */
    subAttackMs: number;
    subReleaseMs: number;
    subGainShare: number;
    midWaveform: 'saw' | 'square';
    midDetuneCents: number;
    midLpfHz: number;
    midSaturation: number;
    midReleaseScale: number;
    bassHpfHz: number;
    gain: number;
  };
  harmony: { stabDecayMs: number; lpfSweepMs: number; stereoWiden: number };
  melody: { pluckDecayMs: number; vibratoRate: number; vibratoDepth: number };
}

function getInstrumentPalette(genre: string, seed: string): InstrumentPalette {
  const g = (genre || 'house').toLowerCase();
  const f = (key: string, lo: number, hi: number) => lo + rand01(seed, `palette:${g}:${key}`) * (hi - lo);
  if (g === 'house') {
    return {
      kick: { pitchDropMs: f('kick:drop', 35, 55), clickAmp: f('kick:click', 0.15, 0.28), saturation: f('kick:sat', 0.12, 0.22) },
      clap: { decayMs: f('clap:decay', 60, 100), roomReflectMs: f('clap:room', 12, 22), filterQ: f('clap:q', 1.5, 2.5) },
      hat: { decayMs: f('hat:decay', 12, 28), highpassHz: f('hat:hp', 6000, 10000) },
      bass: {
        subAttackMs: f('bass:subA', 8, 15),
        subReleaseMs: f('bass:subR', 180, 320),
        subGainShare: f('bass:subShare', 0.70, 0.85),
        midWaveform: rand01(seed, 'palette:bass:midWave') < 0.5 ? 'saw' : 'square',
        midDetuneCents: randSigned(seed, 'palette:bass:midDetune') * 3,
        midLpfHz: f('bass:midLpf', 700, 1100),
        midSaturation: f('bass:midSat', 0.02, 0.06),
        midReleaseScale: f('bass:midRel', 0.70, 0.85),
        bassHpfHz: f('bass:hpf', 35, 40),
        gain: f('bass:gain', 0.52, 0.68),
      },
      harmony: { stabDecayMs: f('harm:decay', 80, 160), lpfSweepMs: f('harm:sweep', 40, 90), stereoWiden: f('harm:widen', 0.06, 0.14) },
      melody: { pluckDecayMs: f('mel:pluck', 50, 120), vibratoRate: f('mel:vibRate', 4.5, 6.5), vibratoDepth: f('mel:vibDepth', 0.004, 0.012) },
    };
  }
  return getInstrumentPalette('house', seed);
}

/** Deterministic PRNG stream from seed+key. Yields [0,1). */
function makePrng(seed: string, key: string): () => number {
  let s = hashU32(seed, key);
  return () => {
    s = Math.imul(s ^ (s >>> 15), 0x85ebca6b);
    s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35);
    return ((s ^ (s >>> 16)) >>> 0) / 0x100000000;
  };
}

/** Soft saturation: keep headroom, deterministic. */
function saturate(x: number, amount: number): number {
  if (amount <= 0) return x;
  const t = x * (1 + amount);
  return Math.tanh(t);
}

/** One-pole lowpass: y = yPrev + coef * (x - yPrev). coef = 1 - exp(-2*pi*cutoff/sr). */
function lpfCoef(cutoffHz: number, sampleRate: number): number {
  return 1 - Math.exp(-2 * Math.PI * cutoffHz / sampleRate);
}

/** One-pole highpass: stateful, init state=0. */
function hpFilter(x: number, prev: number, coef: number): { y: number; state: number } {
  const state = prev + coef * (x - prev);
  return { y: x - state, state };
}

/** Add to FX send buses. ch+pitch identify the source; send amounts from fxSends. */
function addToSends(
  i: number,
  samp: number,
  gainL: number,
  gainR: number,
  ch: ChannelRole,
  pitch: number,
  fxSends: FXSendAmounts,
  roomL: Float32Array, roomR: Float32Array | null,
  plateL: Float32Array, plateR: Float32Array | null,
  delayL: Float32Array, delayR: Float32Array | null,
  useMono: boolean
): void {
  const sRoom = ch === 'rhythm'
    ? (pitch === PITCH_KICK ? fxSends.room.kick : pitch === PITCH_HAT ? fxSends.room.hat : fxSends.room.clap)
    : ch === 'bass' ? fxSends.room.bass : ch === 'harmony' ? fxSends.room.harmony : fxSends.room.melody;
  const sPlate = ch === 'rhythm'
    ? (pitch === PITCH_KICK ? fxSends.plate.kick : pitch === PITCH_HAT ? fxSends.plate.hat : fxSends.plate.clap)
    : ch === 'bass' ? fxSends.plate.bass : ch === 'harmony' ? fxSends.plate.harmony : fxSends.plate.melody;
  const sDelay = ch === 'rhythm'
    ? (pitch === PITCH_KICK ? fxSends.delay.kick : pitch === PITCH_HAT ? fxSends.delay.hat : fxSends.delay.clap)
    : ch === 'bass' ? fxSends.delay.bass : ch === 'harmony' ? fxSends.delay.harmony : fxSends.delay.melody;
  if (sRoom > 0) {
    roomL[i] = (roomL[i] ?? 0) + samp * gainL * sRoom;
    if (roomR && !useMono) roomR[i] = (roomR[i] ?? 0) + samp * gainR * sRoom;
  }
  if (sPlate > 0) {
    plateL[i] = (plateL[i] ?? 0) + samp * gainL * sPlate;
    if (plateR && !useMono) plateR[i] = (plateR[i] ?? 0) + samp * gainR * sPlate;
  }
  if (sDelay > 0) {
    delayL[i] = (delayL[i] ?? 0) + samp * gainL * sDelay;
    if (delayR && !useMono) delayR[i] = (delayR[i] ?? 0) + samp * gainR * sDelay;
  }
}

/** Compute peak and RMS for a float buffer. */
function computeChannelStats(stem: Float32Array): ChannelStats {
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < stem.length; i++) {
    const v = stem[i] ?? 0;
    if (Math.abs(v) > peak) peak = Math.abs(v);
    sumSq += v * v;
  }
  return { peak, rms: stem.length > 0 ? Math.sqrt(sumSq / stem.length) : 0 };
}

// --- B) Performance params (all derived from seed + plan stats) ---

export interface PerformanceParams {
  timingJitterMs: { melody: number; harmony: number; bass: number; rhythm: number };
  timingJitterLongNoteMs: number;
  swing: { enabled: boolean; ratio: number; grid: '8th' | '16th' };
  velocity: {
    phraseCurveMin: number;
    phraseCurveMax: number;
    accentDownbeat: number;
    cadenceAccent: number;
    passingToneReduce: number;
    randomVar: number;
  };
  articulation: { phraseGapMsMelody: number; phraseGapMsHarmony: number; minNoteDurSec: number };
  legatoOverlapMs: number;
  releaseMinMs: number;
  adsr: {
    melody: { attackMs: number; decayMs: number; sustain: number; releaseMs: number };
    harmony: { attackMs: number; decayMs: number; sustain: number; releaseMs: number };
    bass: { attackMs: number; decayMs: number; sustain: number; releaseMs: number };
    rhythm: { attackMs: number; decayMs: number; sustain: number; releaseMs: number };
  };
  spatial: { panMelody: number; panHarmony: number; panBass: number; panRhythm: number; reverbMix: number };
}

function getPerformanceParams(seed: string, bpm: number): PerformanceParams {
  const f = (key: string, lo: number, hi: number) => lo + rand01(seed, key) * (hi - lo);
  const fSigned = (key: string, absMax: number) => randSigned(seed, key) * absMax;
  return {
    // Context-aware jitter applied per-note from these max values (long notes get less)
    timingJitterMs: {
      melody: f('jitter:melody', 4, 8),
      harmony: f('jitter:harmony', 0, 4),
      bass: f('jitter:bass', 1, 4),
      rhythm: f('jitter:rhythm', 0, 2),
    },
    timingJitterLongNoteMs: 3,
    swing: {
      enabled: rand01(seed, 'swing:enabled') < 0.6,
      ratio: f('swing:ratio', 0.52, 0.55),
      grid: '8th' as const,
    },
    velocity: {
      phraseCurveMin: f('vel:phraseLo', 0.92, 0.98),
      phraseCurveMax: f('vel:phraseHi', 1.02, 1.12),
      accentDownbeat: f('vel:downbeat', 0.05, 0.11),
      cadenceAccent: f('vel:cadence', 0.08, 0.16),
      passingToneReduce: -f('vel:passing', 0.05, 0.11),
      randomVar: f('vel:var', 0.03, 0.06),
    },
    articulation: {
      phraseGapMsMelody: f('art:gapMel', 10, 18),
      phraseGapMsHarmony: f('art:gapHarm', 12, 22),
      minNoteDurSec: 0.03,
    },
    legatoOverlapMs: 80,
    adsr: {
      melody: {
        attackMs: f('adsr:mel:a', 5, 12),
        decayMs: f('adsr:mel:d', 40, 80),
        sustain: 0.75,
        releaseMs: f('adsr:mel:r', 120, 220),
      },
      harmony: {
        attackMs: f('adsr:harm:a', 20, 40),
        decayMs: f('adsr:harm:d', 60, 120),
        sustain: 0.85,
        releaseMs: f('adsr:harm:r', 120, 250),
      },
      bass: {
        attackMs: f('adsr:bass:a', 5, 12),
        decayMs: f('adsr:bass:d', 30, 70),
        sustain: 0.78,
        releaseMs: f('adsr:bass:r', 120, 200),
      },
      rhythm: {
        attackMs: f('adsr:rhythm:a', 2, 8),
        decayMs: f('adsr:rhythm:d', 20, 50),
        sustain: 0.3,
        releaseMs: f('adsr:rhythm:r', 25, 60),
      },
    },
    releaseMinMs: 20,
    spatial: {
      panMelody: fSigned('pan:melody', 0.15),
      panHarmony: 0.25,
      panBass: 0,
      panRhythm: fSigned('pan:rhythm', 0.12),
      reverbMix: f('reverb', 0.06, 0.14),
    },
  };
}

// --- Helpers: lerp, envelope, constant-power pan ---

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** ADSR envelope gain at time t (relative to note start). Duration is note length in sec. */
function adsrGain(
  t: number,
  durationSec: number,
  attackMs: number,
  decayMs: number,
  sustain: number,
  releaseMs: number
): number {
  const a = attackMs * 0.001;
  const d = decayMs * 0.001;
  const r = releaseMs * 0.001;
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return lerp(1, sustain, (t - a) / d);
  const sustainStart = a + d;
  const releaseStart = Math.max(sustainStart, durationSec - r);
  if (t < releaseStart) return sustain;
  if (t >= durationSec) return 0;
  return sustain * (1 - (t - releaseStart) / (durationSec - releaseStart));
}

/** Constant-power pan: pan in [-1,1] => (gainL, gainR). */
function panGains(pan: number): { l: number; r: number } {
  const p = Math.max(-1, Math.min(1, pan));
  const angle = (p + 1) * 0.5 * Math.PI * 0.5;
  return { l: Math.cos(angle), r: Math.sin(angle) };
}

/** Resolve channel from event record; default 'melody' for backward compat. */
function eventChannel(ev: Record<string, unknown>): ChannelRole {
  const c = ev.channel;
  if (c === 'melody' || c === 'harmony' || c === 'rhythm' || c === 'bass') return c;
  return 'melody';
}

/** Compute rendered t0/t1 for an event (with jitter, swing, phrase breathing). Used for kick-onset collection and main loop. */
function computeRenderedTiming(
  ev: Record<string, unknown>,
  ch: ChannelRole,
  eventIndex: number,
  nextT0: number | null,
  params: PerformanceParams,
  seed: string,
  secPerBeat: number,
  secPerBar: number
): { t0: number; t1: number } {
  const t0Plan = Number(ev.t0) ?? 0;
  const t1Plan = Number(ev.t1) ?? t0Plan + 0.5;
  const durPlan = t1Plan - t0Plan;
  const bar = Math.floor(t0Plan / secPerBar);

  let jitterSec = 0;
  const longNoteThresholdSec = 0.5;
  const isLongNote = durPlan >= longNoteThresholdSec;
  const jitterMaxMs = isLongNote ? params.timingJitterLongNoteMs : params.timingJitterMs[ch];
  jitterSec = (jitterMaxMs * 0.001) * randSigned(seed, `timing:${ch}:${eventIndex}:${bar}`);

  let t0 = t0Plan + jitterSec;
  let t1 = t1Plan;

  const phraseSec = PHRASE_BARS * secPerBar;
  const phraseIndex = Math.min(3, Math.floor(t0Plan / phraseSec));
  const barInPhrase = bar % PHRASE_BARS;
  const rubatoMs = (barInPhrase === 3 || barInPhrase === 0) && (ch === 'melody' || ch === 'harmony')
    ? (rand01(seed, `rubato:${ch}:${bar}:${eventIndex}`) * 8 - 4) * 0.001
    : 0;
  t0 += rubatoMs;
  t0 = Math.max(0, t0);
  if (t1 - t0 < 0.001) t1 = t0 + 0.001;

  if (params.swing.enabled && secPerBeat > 0 && (ch === 'rhythm' || (ch === 'melody' && durPlan < 0.3))) {
    const beatInBar = (t0Plan % secPerBar) / secPerBeat;
    const eighth = Math.floor(beatInBar * 2) / 2;
    const isOffEighth = Math.abs(beatInBar - eighth - 0.5) < 0.05;
    if (isOffEighth) {
      t0 += (params.swing.ratio - 0.5) * (secPerBeat * 0.5);
    }
  }
  t0 = Math.max(0, t0);
  const minDur = params.articulation.minNoteDurSec;
  if (t1 - t0 < minDur) t1 = t0 + minDur;

  const gapMs = ch === 'melody' ? params.articulation.phraseGapMsMelody : ch === 'harmony' ? params.articulation.phraseGapMsHarmony : 0;
  if (barInPhrase === 3 && gapMs > 0 && (ch === 'melody' || ch === 'harmony')) {
    const gapSec = gapMs * 0.001;
    const wouldCreateGap = nextT0 !== null && (t1 - gapSec) < nextT0 && nextT0 > t1;
    if (!wouldCreateGap) {
      t1 = Math.max(t0 + minDur, t1 - gapSec);
    }
  }
  return { t0, t1 };
}

/** Envelope-based duck per kick onset: fast attack, short hold, fast recovery. Duck only after kick (dt >= 0). */
function duckEnvelopeGain(t: number, kickOnsets: number[], depthBass: number, depthHarmony: number): { bass: number; harmony: number } {
  const attackSec = 0.003;
  const holdSec = 0.025;
  const recoverySec = 0.05;
  let gBass = 1;
  let gHarmony = 1;
  for (const tk of kickOnsets) {
    const dt = t - tk;
    if (dt >= 0 && dt < attackSec + holdSec + recoverySec) {
      if (dt < attackSec) {
        const fade = dt / attackSec;
        gBass = Math.min(gBass, Math.max(0.4, 1 - depthBass * (1 - fade)));
        gHarmony = Math.min(gHarmony, Math.max(0.75, 1 - depthHarmony * (1 - fade)));
      } else if (dt < attackSec + holdSec) {
        gBass = Math.min(gBass, Math.max(0.4, 1 - depthBass));
        gHarmony = Math.min(gHarmony, Math.max(0.75, 1 - depthHarmony));
      } else {
        const recT = (dt - attackSec - holdSec) / recoverySec;
        const fade = Math.min(1, recT);
        gBass = Math.min(gBass, Math.max(0.4, 1 - depthBass * (1 - fade)));
        gHarmony = Math.min(gHarmony, Math.max(0.75, 1 - depthHarmony * (1 - fade)));
      }
    }
  }
  return { bass: gBass, harmony: gHarmony };
}

/** Stem buffers for per-channel stats when returnChannelStats or INSTRUMENTATION_DEBUG. */
interface Stems {
  kick: Float32Array;
  hat: Float32Array;
  clap: Float32Array;
  bass: Float32Array;
  harmony: Float32Array;
  melody: Float32Array;
}

/** Build 16-bit PCM WAV buffer for exactly 60 seconds. Deterministic from hash and plan. */
function buildWav(
  seed: string,
  plan: unknown,
  sampleRate: number,
  channels: number,
  genre?: string,
  stems?: Stems,
  fxStatsOut?: FxRoutingStats
): Buffer {
  const totalSamples = Math.floor(DURATION_SEC * sampleRate) * channels;
  const bytesPerSample = 2;
  const dataLen = totalSamples * bytesPerSample;
  const headerLen = 44;
  const buffer = Buffer.alloc(headerLen + dataLen);
  let offset = 0;

  const writeU16 = (v: number) => {
    buffer.writeUInt16LE(v & 0xffff, offset);
    offset += 2;
  };
  const writeU32 = (v: number) => {
    buffer.writeUInt32LE(v >>> 0, offset);
    offset += 4;
  };

  // RIFF header
  buffer.write('RIFF', 0);
  offset = 4;
  writeU32(36 + dataLen);
  buffer.write('WAVE', offset);
  offset += 4;
  buffer.write('fmt ', offset);
  offset += 4;
  writeU32(16);
  writeU16(1); // PCM
  writeU16(channels);
  writeU32(sampleRate);
  writeU32(sampleRate * channels * bytesPerSample);
  writeU16(channels * bytesPerSample);
  writeU16(16);
  buffer.write('data', offset);
  offset += 4;
  writeU32(dataLen);

  const planObj = plan && typeof plan === 'object' ? (plan as Record<string, unknown>) : null;
  const events = Array.isArray(planObj?.events) ? (planObj.events as Array<Record<string, unknown>>) : null;
  const bpm = typeof planObj?.bpm === 'number' ? planObj.bpm : 120;

  const toInt16 = (x: number) => Math.max(-32768, Math.min(32767, Math.floor(x * 32767)));

  if (events && events.length > 0) {
    const bufL = new Float32Array(Math.floor(DURATION_SEC * sampleRate));
    const bufR = channels >= 2 ? new Float32Array(Math.floor(DURATION_SEC * sampleRate)) : bufL;
    const sorted = [...events].sort((a, b) => (Number(a.t0) || 0) - (Number(b.t0) || 0));
    const secPerBeat = 60 / bpm;
    const secPerBar = secPerBeat * 4;
    let kickOnsets: number[] = [];
    let duckSumBass = 0, duckCountBass = 0, duckSumHarmony = 0, duckCountHarmony = 0;
    let debugSubPeak = 0, debugSubSumSq = 0, debugMidPeak = 0, debugMidSumSq = 0, debugBassSampleCount = 0;
    let activeStems: Stems | null = null;
    let debugFxSends: FXSendAmounts | null = null;
    let debugFxStats: FxRoutingStats | null = null;

    if (HUMANIZE_ENABLED) {
      const params = getPerformanceParams(seed, bpm);

      // Precompute next same-channel event t0 for legato and phrase-gap (avoid mid-line silence)
      const nextSameChannelT0: (number | null)[] = [];
      for (let i = 0; i < sorted.length; i++) {
        const ch = eventChannel(sorted[i]);
        let next: number | null = null;
        for (let j = i + 1; j < sorted.length; j++) {
          if (eventChannel(sorted[j]) === ch) {
            next = Number(sorted[j].t0) ?? 0;
            break;
          }
        }
        nextSameChannelT0.push(next);
      }

      const useInstrumentation = HUMANIZE_ENABLED && INSTRUMENTATION_ENABLED;
      const palette = useInstrumentation ? getInstrumentPalette(genre || 'house', seed) : null;
      const fxSends = useInstrumentation ? getFXSendAmounts(genre || 'house', seed) : null;
      if (fxSends && INSTRUMENTATION_DEBUG) debugFxSends = fxSends;

      const lenSamples = bufL.length;
      const roomSendL = useInstrumentation ? new Float32Array(lenSamples) : null;
      const roomSendR = useInstrumentation && channels >= 2 ? new Float32Array(lenSamples) : null;
      const plateSendL = useInstrumentation ? new Float32Array(lenSamples) : null;
      const plateSendR = useInstrumentation && channels >= 2 ? new Float32Array(lenSamples) : null;
      const delaySendL = useInstrumentation ? new Float32Array(lenSamples) : null;
      const delaySendR = useInstrumentation && channels >= 2 ? new Float32Array(lenSamples) : null;
      const needStems = stems || (useInstrumentation && INSTRUMENTATION_DEBUG);
      if (needStems) {
        activeStems = stems ?? {
          kick: new Float32Array(lenSamples), hat: new Float32Array(lenSamples), clap: new Float32Array(lenSamples),
          bass: new Float32Array(lenSamples), harmony: new Float32Array(lenSamples), melody: new Float32Array(lenSamples),
        };
      }

      if (useInstrumentation && palette) {
        for (let i = 0; i < sorted.length; i++) {
          const ev = sorted[i];
          const ch = eventChannel(ev);
          const pitch = Number(ev.pitch) ?? 69;
          if (ch === 'rhythm' && pitch === PITCH_KICK) {
            const { t0 } = computeRenderedTiming(ev, ch, i, nextSameChannelT0[i], params, seed, secPerBeat, secPerBar);
            kickOnsets.push(t0);
          }
        }
      }

      for (let eventIndex = 0; eventIndex < sorted.length; eventIndex++) {
        const ev = sorted[eventIndex];
        const ch = eventChannel(ev);
        const t0Plan = Number(ev.t0) ?? 0;
        const t1Plan = Number(ev.t1) ?? t0Plan + 0.5;
        const pitch = Number(ev.pitch) ?? 69;
        const velPlan = Math.max(0, Math.min(1, Number(ev.velocity) ?? 0.8));
        const durPlan = t1Plan - t0Plan;
        const nextT0 = nextSameChannelT0[eventIndex];
        const bar = Math.floor(t0Plan / secPerBar);

        const { t0, t1 } = computeRenderedTiming(ev, ch, eventIndex, nextT0, params, seed, secPerBeat, secPerBar);
        const minDur = params.articulation.minNoteDurSec;
        const durationSec = Math.max(minDur, t1 - t0);
        const phraseSec = PHRASE_BARS * secPerBar;
        const phraseIndex = Math.min(3, Math.floor(t0Plan / phraseSec));
        const barInPhrase = bar % PHRASE_BARS;

        // --- D) Velocity dynamics (legacy phrase swell) ---
        const phrasePosition = (bar % TOTAL_BARS) / TOTAL_BARS;
        const phraseSwell = lerp(params.velocity.phraseCurveMin, params.velocity.phraseCurveMax, phrasePosition);

        // --- D2) Phrase envelope v2: rise -> peak -> fall + breath dip at phrase end (4 phrases over 16 bars) ---
        const localPos = (t0Plan - phraseIndex * phraseSec) / phraseSec;
        const arc = 0.94 + 0.08 * Math.sin(Math.PI * Math.max(0, Math.min(1, localPos)));
        const breathDip = localPos > 0.9 ? 1 - 0.12 * (localPos - 0.9) / 0.1 : 1;
        const phraseEnvelope = arc * breathDip;
        const phraseWeight = ch === 'melody' || ch === 'harmony' ? 1 : ch === 'bass' ? 0.5 : 0.2;
        const phraseCurve = 1 + (phraseEnvelope - 1) * phraseWeight;

        let vel = velPlan * phraseSwell * phraseCurve;

        const beatInBar = (t0Plan % secPerBar) / secPerBeat;
        const isDownbeat = beatInBar < 0.15;
        if (isDownbeat) vel += params.velocity.accentDownbeat;
        if (barInPhrase === 3 && ch === 'melody') vel += params.velocity.cadenceAccent;

        const isPassingTone = durPlan < 0.35 && !isDownbeat && Math.abs(beatInBar - 2) > 0.2;
        if (isPassingTone) vel += params.velocity.passingToneReduce;

        const varKey = `vel:${ch}:${eventIndex}:${bar}`;
        vel += randSigned(seed, varKey) * params.velocity.randomVar;
        vel = Math.max(0, Math.min(1, vel));

        // --- F) ADSR with legato: extend release when next note in same channel is within overlap window ---
        const adsr = params.adsr[ch];
        let releaseMs = Math.max(params.releaseMinMs, adsr.releaseMs);
        if (nextT0 !== null && (nextT0 - t1) < (params.legatoOverlapMs * 0.001) && (nextT0 - t1) > 0 && (ch === 'melody' || ch === 'harmony')) {
          const gapToNext = (nextT0 - t1) * 1000;
          releaseMs = Math.max(releaseMs, gapToNext + 25);
        }
        // Phrase-boundary release lengthening (Performance Layer v2): deterministic from seed
        const phraseEndSec = (phraseIndex + 1) * phraseSec;
        if (t1 >= phraseEndSec - 0.12 && (ch === 'melody' || ch === 'harmony')) {
          const stretch = 1 + 0.25 * rand01(seed, `release:${ch}:${bar}:${eventIndex}`);
          releaseMs = releaseMs * stretch;
        }
        const attackMs = adsr.attackMs;
        const decayMs = adsr.decayMs;
        const sustain = adsr.sustain;

        const freq = A440 * Math.pow(2, (pitch - 69) / 12);
        const startS = Math.max(0, Math.floor(t0 * sampleRate));
        const endS = Math.min(bufL.length, Math.ceil(t1 * sampleRate));

        const pan = ch === 'melody' ? params.spatial.panMelody
          : ch === 'harmony' ? params.spatial.panHarmony
          : ch === 'bass' ? params.spatial.panBass
          : params.spatial.panRhythm;
        const { l: gainL, r: gainR } = panGains(pan);
        const amp = vel * 0.3;
        const useMono = channels < 2;

        if (useInstrumentation && palette) {
          const eventKey = `inst:${ch}:${eventIndex}:${bar}`;
          const prng = makePrng(seed, eventKey);

          if (ch === 'rhythm' && pitch === PITCH_KICK && palette.kick) {
            const k = palette.kick;
            const dropSec = k.pitchDropMs * 0.001;
            const clickDur = Math.min(0.003, durationSec * 0.3);
            const freqStart = 120;
            const freqEnd = 45;
            let phase = 0;
            for (let i = startS; i < endS; i++) {
              const localT = i / sampleRate - t0;
              const env = adsrGain(localT, durationSec, attackMs, decayMs, sustain, releaseMs);
              const pitchMult = localT < dropSec ? 1 - (localT / dropSec) * 0.65 : 0.35;
              const f = freqEnd + (freqStart - freqEnd) * pitchMult;
              phase += (2 * Math.PI * f) / sampleRate;
              if (phase > Math.PI * 2) phase -= Math.PI * 2;
              let samp = Math.sin(phase) * amp * env;
              if (localT < clickDur) {
                samp += (prng() * 2 - 1) * k.clickAmp * (1 - localT / clickDur);
              }
              samp = saturate(samp, k.saturation);
              if (activeStems) activeStems.kick[i] = (activeStems.kick[i] ?? 0) + samp;
              if (fxSends && roomSendL && plateSendL && delaySendL) {
                addToSends(i, samp, gainL, gainR, ch, pitch, fxSends, roomSendL, roomSendR, plateSendL, plateSendR, delaySendL, delaySendR, useMono);
              }
              if (useMono) bufL[i] = (bufL[i] ?? 0) + samp;
              else { bufL[i] = (bufL[i] ?? 0) + samp * gainL; bufR[i] = (bufR[i] ?? 0) + samp * gainR; }
            }
          } else if (ch === 'rhythm' && pitch === PITCH_HAT && palette.hat) {
            const h = palette.hat;
            const hpCoef = lpfCoef(h.highpassHz, sampleRate);
            let hpStateL = 0, hpStateR = 0;
            for (let i = startS; i < endS; i++) {
              const localT = i / sampleRate - t0;
              const decay = Math.exp(-localT * 1000 / h.decayMs);
              const n = (prng() * 2 - 1) * amp * decay * adsrGain(localT, durationSec, attackMs, decayMs, sustain, releaseMs);
              const { y: yL, state: sL } = hpFilter(n, hpStateL, hpCoef);
              const { y: yR, state: sR } = hpFilter(n, hpStateR, hpCoef);
              hpStateL = sL; hpStateR = sR;
              if (activeStems) activeStems.hat[i] = (activeStems.hat[i] ?? 0) + yL;
              if (fxSends && roomSendL && plateSendL && delaySendL) {
                addToSends(i, yL, gainL, gainR, ch, pitch, fxSends, roomSendL, roomSendR, plateSendL, plateSendR, delaySendL, delaySendR, useMono);
              }
              if (useMono) bufL[i] = (bufL[i] ?? 0) + yL;
              else { bufL[i] = (bufL[i] ?? 0) + yL * gainL; bufR[i] = (bufR[i] ?? 0) + yR * gainR; }
            }
          } else if (ch === 'rhythm' && pitch === PITCH_CLAP && palette.clap) {
            const c = palette.clap;
            const prngC = makePrng(seed, eventKey + ':clap');
            const reflectSamples = Math.max(1, Math.floor(sampleRate * c.roomReflectMs * 0.001));
            const ring = new Float32Array(reflectSamples);
            let ri = 0;
            for (let i = startS; i < endS; i++) {
              const localT = i / sampleRate - t0;
              const decay = Math.exp(-localT * 1000 / c.decayMs);
              const n = (prngC() * 2 - 1) * amp * decay * adsrGain(localT, durationSec, attackMs, decayMs, sustain, releaseMs);
              const refl = ring[(ri + 1) % reflectSamples] * 0.25;
              ring[ri] = n;
              ri = (ri + 1) % reflectSamples;
              const samp = n + refl;
              if (activeStems) activeStems.clap[i] = (activeStems.clap[i] ?? 0) + samp;
              if (fxSends && roomSendL && plateSendL && delaySendL) {
                addToSends(i, samp, gainL, gainR, ch, pitch, fxSends, roomSendL, roomSendR, plateSendL, plateSendR, delaySendL, delaySendR, useMono);
              }
              if (useMono) bufL[i] = (bufL[i] ?? 0) + samp;
              else { bufL[i] = (bufL[i] ?? 0) + samp * gainL; bufR[i] = (bufR[i] ?? 0) + samp * gainR; }
            }
          } else if (ch === 'bass' && palette.bass) {
            const b = palette.bass;
            const subShare = b.subGainShare;
            const midShare = 1 - subShare;
            const subGain = amp * b.gain * subShare;
            const midGain = amp * b.gain * midShare;
            const subAttackMs = b.subAttackMs;
            const subReleaseMs = b.subReleaseMs;
            const midReleaseMs = subReleaseMs * b.midReleaseScale;
            const freqMid = freq * Math.pow(2, b.midDetuneCents / 1200);
            const subPhaseInc = freq / sampleRate;
            const midPhaseInc = freqMid / sampleRate;
            let subPhase = rand01(seed, eventKey + ':subPh');
            let midPhase = rand01(seed, eventKey + ':midPh');
            const subLpfC = lpfCoef(120, sampleRate);
            const midLpfC = lpfCoef(b.midLpfHz, sampleRate);
            const bassHpfC = lpfCoef(b.bassHpfHz, sampleRate);
            let subLpfState = 0;
            let midLpfState = 0;
            let bassHpfState = 0;
            for (let i = startS; i < endS; i++) {
              const t = i / sampleRate;
              const localT = t - t0;
              const subEnv = adsrGain(localT, durationSec, subAttackMs, decayMs, sustain, subReleaseMs);
              const midEnv = adsrGain(localT, durationSec, subAttackMs, decayMs, sustain, midReleaseMs);
              const subRaw = Math.sin(2 * Math.PI * subPhase);
              subPhase += subPhaseInc;
              if (subPhase >= 1) subPhase -= 1;
              subLpfState += subLpfC * (subRaw - subLpfState);
              const midRaw = b.midWaveform === 'saw' ? 2 * (midPhase - Math.floor(midPhase)) - 1 : midPhase < 0.5 ? 1 : -1;
              midPhase += midPhaseInc;
              if (midPhase >= 1) midPhase -= 1;
              midLpfState += midLpfC * (midRaw - midLpfState);
              const midSaturated = saturate(midLpfState, b.midSaturation);
              const subSamp = subLpfState * subGain * subEnv;
              const midSamp = midSaturated * midGain * midEnv;
              const combined = subSamp + midSamp;
              bassHpfState += bassHpfC * (combined - bassHpfState);
              let samp = combined - bassHpfState;
              if (INSTRUMENTATION_DEBUG) {
                const sSub = Math.abs(subSamp);
                const sMid = Math.abs(midSamp);
                if (sSub > debugSubPeak) debugSubPeak = sSub;
                if (sMid > debugMidPeak) debugMidPeak = sMid;
                debugSubSumSq += subSamp * subSamp;
                debugMidSumSq += midSamp * midSamp;
                debugBassSampleCount++;
              }
              const { bass: duckB } = duckEnvelopeGain(t, kickOnsets, 0.22, 0.10);
              duckSumBass += duckB; duckCountBass++;
              samp *= duckB;
              if (activeStems) activeStems.bass[i] = (activeStems.bass[i] ?? 0) + samp;
              if (fxSends && roomSendL && plateSendL && delaySendL) {
                addToSends(i, samp, gainL, gainR, ch, pitch, fxSends, roomSendL, roomSendR, plateSendL, plateSendR, delaySendL, delaySendR, useMono);
              }
              if (useMono) bufL[i] = (bufL[i] ?? 0) + samp;
              else { bufL[i] = (bufL[i] ?? 0) + samp * gainL; bufR[i] = (bufR[i] ?? 0) + samp * gainR; }
            }
          } else if (ch === 'harmony' && palette.harmony) {
            const harm = palette.harmony;
            const widen = harm.stereoWiden * randSigned(seed, eventKey + ':widen');
            let phase = 0;
            const phaseInc = freq / sampleRate;
            const lpfSweep = harm.lpfSweepMs * 0.001;
            const lpfStart = lpfCoef(400, sampleRate);
            const lpfEnd = lpfCoef(1200, sampleRate);
            let lpfState = 0;
            let lpfC = lpfStart;
            for (let i = startS; i < endS; i++) {
              const t = i / sampleRate;
              const localT = t - t0;
              const sweepT = Math.min(1, localT / lpfSweep);
              lpfC = lpfStart + (lpfEnd - lpfStart) * sweepT;
              const env = adsrGain(localT, durationSec, attackMs, decayMs, sustain, releaseMs);
              const raw = Math.sin(2 * Math.PI * phase);
              phase += phaseInc;
              if (phase >= 1) phase -= 1;
              lpfState += lpfC * (raw - lpfState);
              let samp = lpfState * amp * env;
              const { harmony: duckH } = duckEnvelopeGain(t, kickOnsets, 0.22, 0.10);
              duckSumHarmony += duckH; duckCountHarmony++;
              samp *= duckH;
              if (activeStems) activeStems.harmony[i] = (activeStems.harmony[i] ?? 0) + samp;
              const gL = gainL + widen;
              const gR = gainR - widen;
              if (fxSends && roomSendL && plateSendL && delaySendL) {
                addToSends(i, samp, Math.max(0, gL), Math.max(0, gR), ch, pitch, fxSends, roomSendL, roomSendR, plateSendL, plateSendR, delaySendL, delaySendR, useMono);
              }
              if (useMono) bufL[i] = (bufL[i] ?? 0) + samp;
              else { bufL[i] = (bufL[i] ?? 0) + samp * Math.max(0, gL); bufR[i] = (bufR[i] ?? 0) + samp * Math.max(0, gR); }
            }
          } else if (ch === 'melody' && palette.melody) {
            const m = palette.melody;
            let phase = 0;
            const phaseInc = freq / sampleRate;
            for (let i = startS; i < endS; i++) {
              const t = i / sampleRate;
              const localT = t - t0;
              const pluckEnv = Math.exp(-localT * 1000 / m.pluckDecayMs);
              const vibMod = 1 + m.vibratoDepth * Math.sin(2 * Math.PI * m.vibratoRate * localT);
              const env = adsrGain(localT, durationSec, attackMs, decayMs, sustain, releaseMs) * pluckEnv;
              phase += phaseInc * vibMod;
              if (phase >= 1) phase -= 1;
              const samp = Math.sin(2 * Math.PI * phase) * amp * env;
              if (activeStems) activeStems.melody[i] = (activeStems.melody[i] ?? 0) + samp;
              if (fxSends && roomSendL && plateSendL && delaySendL) {
                addToSends(i, samp, gainL, gainR, ch, pitch, fxSends, roomSendL, roomSendR, plateSendL, plateSendR, delaySendL, delaySendR, useMono);
              }
              if (useMono) bufL[i] = (bufL[i] ?? 0) + samp;
              else { bufL[i] = (bufL[i] ?? 0) + samp * gainL; bufR[i] = (bufR[i] ?? 0) + samp * gainR; }
            }
          } else {
            const fallbackPhase = rand01(seed, eventKey + ':ph');
            let phase = fallbackPhase;
            const phaseInc = freq / sampleRate;
            for (let i = startS; i < endS; i++) {
              const localT = i / sampleRate - t0;
              const env = adsrGain(localT, durationSec, attackMs, decayMs, sustain, releaseMs);
              const samp = Math.sin(2 * Math.PI * phase) * amp * env;
              phase += phaseInc;
              if (phase >= 1) phase -= 1;
              if (useMono) bufL[i] = (bufL[i] ?? 0) + samp;
              else { bufL[i] = (bufL[i] ?? 0) + samp * gainL; bufR[i] = (bufR[i] ?? 0) + samp * gainR; }
            }
          }
        } else {
          let phase = 0;
          const phaseInc = freq / sampleRate;
          for (let i = startS; i < endS; i++) {
            const t = i / sampleRate;
            const localT = t - t0;
            const env = adsrGain(localT, durationSec, attackMs, decayMs, sustain, releaseMs);
            const samp = Math.sin(2 * Math.PI * phase) * amp * env;
            phase += phaseInc;
            if (phase >= 1) phase -= 1;
            if (useMono) {
              bufL[i] = (bufL[i] ?? 0) + samp;
            } else {
              bufL[i] = (bufL[i] ?? 0) + samp * gainL;
              bufR[i] = (bufR[i] ?? 0) + samp * gainR;
            }
          }
        }
      }

      if (useInstrumentation && roomSendL && plateSendL && delaySendL && fxSends) {
        const len = bufL.length;
        const hpFreq = 250;
        const lpFreq = 9000;
        const hpCoefIn = lpfCoef(hpFreq, sampleRate);
        const lpCoefOut = lpfCoef(lpFreq, sampleRate);

        const roomD1 = Math.floor(sampleRate * 0.025);
        const roomD2 = Math.floor(sampleRate * 0.065);
        const plateD1 = Math.floor(sampleRate * 0.04);
        const plateD2 = Math.floor(sampleRate * 0.11);
        const delayD = Math.floor(sampleRate * 0.28);

        const roomInL = new Float32Array(len);
        const roomInR = roomSendR ? new Float32Array(len) : roomInL;
        let rhpL = 0, rhpR = 0;
        for (let i = 0; i < len; i++) {
          const sL = roomSendL[i] ?? 0;
          const sR = roomSendR ? (roomSendR[i] ?? 0) : sL;
          rhpL += hpCoefIn * (sL - rhpL);
          rhpR += hpCoefIn * (sR - rhpR);
          roomInL[i] = sL - rhpL;
          roomInR[i] = sR - rhpR;
        }
        const roomRawL = new Float32Array(len);
        const roomRawR = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          roomRawL[i] = (i >= roomD1 ? roomInL[i - roomD1] * 0.38 : 0) + (i >= roomD2 && roomSendR ? roomInR[i - roomD2] * 0.22 : 0);
          roomRawR[i] = (i >= roomD1 ? roomInR[i - roomD1] * 0.38 : 0) + (i >= roomD2 ? roomInL[i - roomD2] * 0.22 : 0);
        }
        let rlpL = 0, rlpR = 0;
        for (let i = 0; i < len; i++) {
          rlpL += lpCoefOut * (roomRawL[i] - rlpL);
          rlpR += lpCoefOut * (roomRawR[i] - rlpR);
          roomRawL[i] = rlpL;
          roomRawR[i] = rlpR;
        }

        const plateInL = new Float32Array(len);
        const plateInR = plateSendR ? new Float32Array(len) : plateInL;
        let phpL = 0, phpR = 0;
        for (let i = 0; i < len; i++) {
          const sL = plateSendL[i] ?? 0;
          const sR = plateSendR ? (plateSendR[i] ?? 0) : sL;
          phpL += hpCoefIn * (sL - phpL);
          phpR += hpCoefIn * (sR - phpR);
          plateInL[i] = sL - phpL;
          plateInR[i] = sR - phpR;
        }
        const plateRawL = new Float32Array(len);
        const plateRawR = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          plateRawL[i] = (i >= plateD1 ? plateInL[i - plateD1] * 0.32 : 0) + (i >= plateD2 && plateSendR ? plateInR[i - plateD2] * 0.18 : 0);
          plateRawR[i] = (i >= plateD1 ? plateInR[i - plateD1] * 0.32 : 0) + (i >= plateD2 ? plateInL[i - plateD2] * 0.18 : 0);
        }
        let plpL = 0, plpR = 0;
        for (let i = 0; i < len; i++) {
          plpL += lpCoefOut * (plateRawL[i] - plpL);
          plpR += lpCoefOut * (plateRawR[i] - plpR);
          plateRawL[i] = plpL;
          plateRawR[i] = plpR;
        }

        const delayInL = new Float32Array(len);
        const delayInR = delaySendR ? new Float32Array(len) : delayInL;
        let dhpL = 0, dhpR = 0;
        for (let i = 0; i < len; i++) {
          const sL = delaySendL[i] ?? 0;
          const sR = delaySendR ? (delaySendR[i] ?? 0) : sL;
          dhpL += hpCoefIn * (sL - dhpL);
          dhpR += hpCoefIn * (sR - dhpR);
          delayInL[i] = sL - dhpL;
          delayInR[i] = sR - dhpR;
        }
        const delayRawL = new Float32Array(len);
        const delayRawR = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          delayRawL[i] = i >= delayD ? delayInL[i - delayD] * 0.35 : 0;
          delayRawR[i] = i >= delayD ? (delaySendR ? delayInR[i - delayD] : delayInL[i - delayD]) * 0.35 : 0;
        }
        let dlpL = 0, dlpR = 0;
        for (let i = 0; i < len; i++) {
          dlpL += lpCoefOut * (delayRawL[i] - dlpL);
          dlpR += lpCoefOut * (delayRawR[i] - dlpR);
          delayRawL[i] = dlpL;
          delayRawR[i] = dlpR;
        }

        const reverbReturnL = new Float32Array(len);
        const reverbReturnR = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          reverbReturnL[i] = roomRawL[i] + plateRawL[i] + delayRawL[i];
          reverbReturnR[i] = roomRawR[i] + plateRawR[i] + delayRawR[i];
        }

        const duckAttackSec = 0.002;
        const duckRecoverySec = 0.035;
        const duckDepth = 0.18;
        for (let i = 0; i < len; i++) {
          const t = i / sampleRate;
          let duck = 1;
          for (const tk of kickOnsets) {
            const dt = t - tk;
            if (dt >= 0 && dt < duckAttackSec + duckRecoverySec) {
              if (dt < duckAttackSec) {
                duck = Math.min(duck, 1 - duckDepth * (1 - dt / duckAttackSec));
              } else {
                const recT = (dt - duckAttackSec) / duckRecoverySec;
                duck = Math.min(duck, 1 - duckDepth * Math.max(0, 1 - recT));
              }
            }
          }
          duck = Math.max(0.7, duck);
          reverbReturnL[i] *= duck;
          reverbReturnR[i] *= duck;
        }

        for (let i = 0; i < len; i++) {
          bufL[i] = (bufL[i] ?? 0) + reverbReturnL[i];
          bufR[i] = (bufR[i] ?? 0) + reverbReturnR[i];
        }

        const statsToFill = fxStatsOut ?? (INSTRUMENTATION_DEBUG ? { bass_send_room: 0, bass_send_plate: 0, bass_send_delay: 0, reverb_return_lowband_rms: 0 } : undefined);
        if (statsToFill && fxSends) {
          const lpf200 = lpfCoef(200, sampleRate);
          let lpL = 0, lpR = 0;
          let sumSq = 0;
          for (let i = 0; i < len; i++) {
            lpL += lpf200 * (reverbReturnL[i] - lpL);
            lpR += lpf200 * (reverbReturnR[i] - lpR);
            const mono = (lpL + lpR) * 0.5;
            sumSq += mono * mono;
          }
          statsToFill.bass_send_room = fxSends.room.bass;
          statsToFill.bass_send_plate = fxSends.plate.bass;
          statsToFill.bass_send_delay = fxSends.delay.bass;
          statsToFill.reverb_return_lowband_rms = len > 0 ? Math.sqrt(sumSq / len) : 0;
          if (INSTRUMENTATION_DEBUG) debugFxStats = statsToFill;
        }
      }

      if (useInstrumentation) {
        const len = bufL.length;
        const hpCoef = lpfCoef(50, sampleRate);
        const lpCoef = lpfCoef(14000, sampleRate);
        let hpL = 0, hpR = 0, lpL = 0, lpR = 0;
        for (let i = 0; i < len; i++) {
          const l = bufL[i] ?? 0;
          const r = channels >= 2 ? (bufR[i] ?? 0) : l;
          hpL += hpCoef * (l - hpL);
          hpR += hpCoef * (r - hpR);
          const lHp = l - hpL;
          const rHp = r - hpR;
          lpL += lpCoef * (lHp - lpL);
          lpR += lpCoef * (rHp - lpR);
          bufL[i] = lpL;
          if (channels >= 2) bufR[i] = lpR;
        }
        const thr = 0.4;
        const ratio = 3;
        const makeup = 1.05;
        let envL = 0, envR = 0;
        const envCoef = lpfCoef(80, sampleRate);
        for (let i = 0; i < len; i++) {
          const l = bufL[i] ?? 0;
          const r = channels >= 2 ? (bufR[i] ?? 0) : l;
          const peak = Math.max(Math.abs(l), Math.abs(r));
          envL += envCoef * (Math.abs(l) - envL);
          envR += envCoef * (Math.abs(r) - envR);
          const env = Math.max(envL, envR);
          let gain = 1;
          if (env > thr) {
            const over = env / thr;
            gain = thr / (thr + (over - 1) / ratio);
          }
          gain *= makeup;
          let lOut = l * gain;
          let rOut = (channels >= 2 ? r : l) * gain;
          lOut = Math.tanh(lOut * 1.02);
          rOut = Math.tanh(rOut * 1.02);
          bufL[i] = lOut;
          if (channels >= 2) bufR[i] = rOut;
        }
      }
    } else {
      // Legacy path: no humanization (flat envelope, no channel, no pan)
      for (const ev of sorted) {
        const t0 = Number(ev.t0) ?? 0;
        const t1 = Number(ev.t1) ?? t0 + 0.5;
        const pitch = Number(ev.pitch) ?? 69;
        const vel = Math.max(0, Math.min(1, Number(ev.velocity) ?? 0.8));
        const freq = A440 * Math.pow(2, (pitch - 69) / 12);
        const startS = Math.max(0, Math.floor(t0 * sampleRate));
        const endS = Math.min(bufL.length, Math.ceil(t1 * sampleRate));
        let phase = 0;
        const phaseInc = freq / sampleRate;
        for (let i = startS; i < endS; i++) {
          const t = i / sampleRate;
          const env = t <= t0 ? 0 : t >= t1 ? 0 : 1;
          const samp = Math.sin(2 * Math.PI * phase) * vel * env * 0.3;
          phase += phaseInc;
          if (phase >= 1) phase -= 1;
          bufL[i] = (bufL[i] ?? 0) + samp;
          if (channels >= 2) bufR[i] = (bufR[i] ?? 0) + samp;
        }
      }
    }

    let peak = 0;
    let sumSq = 0;
    for (let i = 0; i < bufL.length; i++) {
      const v = bufL[i] ?? 0;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sumSq += v * v;
    }
    const rms = bufL.length > 0 ? Math.sqrt(sumSq / bufL.length) : 0;
    const scale = peak > 0.95 ? 0.95 / peak : 1;
    if (INSTRUMENTATION_DEBUG && (activeStems || fxStatsOut)) {
      if (activeStems) {
        const st = activeStems;
        const kickS = computeChannelStats(st.kick);
        const hatS = computeChannelStats(st.hat);
        const clapS = computeChannelStats(st.clap);
        const bassS = computeChannelStats(st.bass);
        const harmS = computeChannelStats(st.harmony);
        const melS = computeChannelStats(st.melody);
        const bassToMaster = peak > 0.001 ? bassS.peak / peak : 0;
        console.log('[INSTRUMENTATION] kick peak=', kickS.peak.toFixed(4), 'rms=', kickS.rms.toFixed(4));
        console.log('[INSTRUMENTATION] hat peak=', hatS.peak.toFixed(4), 'rms=', hatS.rms.toFixed(4));
        console.log('[INSTRUMENTATION] clap peak=', clapS.peak.toFixed(4), 'rms=', clapS.rms.toFixed(4));
        console.log('[INSTRUMENTATION] bass peak=', bassS.peak.toFixed(4), 'rms=', bassS.rms.toFixed(4));
        if (debugBassSampleCount > 0) {
          const subRms = Math.sqrt(debugSubSumSq / debugBassSampleCount);
          const midRms = Math.sqrt(debugMidSumSq / debugBassSampleCount);
          console.log('[INSTRUMENTATION] bass sub peak=', debugSubPeak.toFixed(4), 'rms=', subRms.toFixed(4), 'mid peak=', debugMidPeak.toFixed(4), 'rms=', midRms.toFixed(4));
        }
        console.log('[INSTRUMENTATION] harmony peak=', harmS.peak.toFixed(4), 'rms=', harmS.rms.toFixed(4));
        console.log('[INSTRUMENTATION] melody peak=', melS.peak.toFixed(4), 'rms=', melS.rms.toFixed(4));
        console.log('[INSTRUMENTATION] master peak=', peak.toFixed(4), 'RMS=', rms.toFixed(4), 'bass_to_master_ratio=', bassToMaster.toFixed(4));
      }
      if (debugFxStats && debugFxSends) {
        console.log('[INSTRUMENTATION] bass_send room=', debugFxStats.bass_send_room.toFixed(4), 'plate=', debugFxStats.bass_send_plate.toFixed(4), 'delay=', debugFxStats.bass_send_delay.toFixed(4));
        console.log('[INSTRUMENTATION] reverb_return_lowband_rms=', debugFxStats.reverb_return_lowband_rms.toFixed(6));
        console.log('[INSTRUMENTATION] sends: clap_room=', debugFxSends.room.clap.toFixed(4), 'harm_plate=', debugFxSends.plate.harmony.toFixed(4), 'mel_plate=', debugFxSends.plate.melody.toFixed(4), 'mel_delay=', debugFxSends.delay.melody.toFixed(4));
      }
    }
    offset = headerLen;
    for (let i = 0; i < bufL.length; i++) {
      const l = (bufL[i] ?? 0) * scale;
      buffer.writeInt16LE(toInt16(l), offset);
      offset += 2;
      if (channels >= 2) {
        const r = (bufR[i] ?? 0) * scale;
        buffer.writeInt16LE(toInt16(r), offset);
        offset += 2;
      }
    }
  } else {
    // Fallback: fixed A=440 with seeded variation
    const freqVariation = 0.9 + seedFloat(seed, 0) * 0.2;
    const ampVariation = 0.2 + seedFloat(seed, 1) * 0.15;
    const freq = A440 * freqVariation;
    const numSamples = Math.floor(DURATION_SEC * sampleRate);
    let phase = 0;
    const phaseInc = freq / sampleRate;
    offset = headerLen;
    for (let i = 0; i < numSamples; i++) {
      const samp = Math.sin(2 * Math.PI * phase) * ampVariation;
      phase += phaseInc;
      if (phase >= 1) phase -= 1;
      const s = Math.max(-1, Math.min(1, samp));
      buffer.writeInt16LE(toInt16(s), offset);
      offset += 2;
      if (channels >= 2) {
        buffer.writeInt16LE(toInt16(s), offset);
        offset += 2;
      }
    }
  }

  return buffer;
}

/** Dev-only: assert buffer has RIFF/WAVE header (no logs). */
function assertValidWavInDev(buffer: Buffer): void {
  if (process.env.NODE_ENV === 'production') return;
  if (buffer.length < 12) throw new Error('WAV too short');
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') throw new Error('WAV missing RIFF');
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('WAV missing WAVE');
}

export function renderWav60s(
  planInput: unknown,
  payloadInput: unknown,
  hash: string,
  options?: RenderOptions
): RenderResult {
  try {
    const seed =
      (typeof hash === 'string' && hash) ||
      (payloadInput && typeof (payloadInput as Record<string, unknown>).hash === 'string'
        ? ((payloadInput as Record<string, unknown>).hash as string)
        : '') ||
      (planInput && typeof (planInput as Record<string, unknown>).featureHash === 'string'
        ? ((planInput as Record<string, unknown>).featureHash as string)
        : '') ||
      'default';
    const sampleRate = Math.max(8000, Math.min(48000, options?.sampleRate ?? DEFAULT_SAMPLE_RATE));
    const channels = options?.channels === 2 ? 2 : 1;
    const genre = (payloadInput && typeof (payloadInput as Record<string, unknown>).genre === 'string')
      ? ((payloadInput as Record<string, unknown>).genre as string)
      : 'house';
    const lenSamples = Math.floor(DURATION_SEC * sampleRate);
    const stems = options?.returnChannelStats ? {
      kick: new Float32Array(lenSamples), hat: new Float32Array(lenSamples), clap: new Float32Array(lenSamples),
      bass: new Float32Array(lenSamples), harmony: new Float32Array(lenSamples), melody: new Float32Array(lenSamples),
    } : undefined;
    const fxStatsOut: FxRoutingStats | undefined = options?.returnFxRoutingStats
      ? { bass_send_room: 0, bass_send_plate: 0, bass_send_delay: 0, reverb_return_lowband_rms: 0 }
      : undefined;
    const buffer = buildWav(seed, planInput, sampleRate, channels, genre, stems, fxStatsOut);
    if (process.env.NODE_ENV !== 'production') assertValidWavInDev(buffer);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const durationMs = DURATION_SEC * 1000;
    const sizeBytes = buffer.length;
    const channelStats = stems ? {
      kick: computeChannelStats(stems.kick),
      hat: computeChannelStats(stems.hat),
      clap: computeChannelStats(stems.clap),
      bass: computeChannelStats(stems.bass),
      harmony: computeChannelStats(stems.harmony),
      melody: computeChannelStats(stems.melody),
    } : undefined;
    return { buffer, sha256, duration_ms: durationMs, size_bytes: sizeBytes, channelStats, fxRoutingStats: fxStatsOut };
  } catch {
    const buffer = buildWav('fallback', null, DEFAULT_SAMPLE_RATE, 1, 'house');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const durationMs = DURATION_SEC * 1000;
    const sizeBytes = buffer.length;
    return { buffer, sha256, duration_ms: durationMs, size_bytes: sizeBytes };
  }
}
