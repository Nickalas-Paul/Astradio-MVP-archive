/**
 * Minimal deterministic WAV renderer: plan + payload hash → 60s 16-bit PCM WAV.
 * Performance layer: humanization (velocity, ADSR, phrase breathing, micro-timing, pan)
 * only at render time; Plan/EventToken schema unchanged. Deterministic: same plan + hash ⇒ same WAV sha256.
 */

import * as crypto from 'crypto';

export interface RenderOptions {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
}

export interface RenderResult {
  buffer: Buffer;
  sha256: string;
  duration_ms: number;
  size_bytes: number;
}

const DURATION_SEC = 60;
const DEFAULT_SAMPLE_RATE = 44100;
const A440 = 440;

/** Channel role for rendering (matches EventToken.channel). */
type ChannelRole = 'melody' | 'harmony' | 'rhythm' | 'bass';

/** Humanization on by default; set VNEXT_HUMANIZE=0 to use legacy flat render for debugging. */
const HUMANIZE_ENABLED = process.env.VNEXT_HUMANIZE !== '0';

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

// --- B) Performance params (all derived from seed + plan stats) ---

export interface PerformanceParams {
  timingJitterMs: { melody: number; harmony: number; bass: number; rhythm: number };
  swing: { enabled: boolean; ratio: number; grid: '8th' | '16th' };
  velocity: {
    phraseCurveMin: number;
    phraseCurveMax: number;
    accentDownbeat: number;
    cadenceAccent: number;
    passingToneReduce: number;
    randomVar: number;
  };
  articulation: { phraseGapMs: number; minNoteDurSec: number };
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
    timingJitterMs: {
      melody: f('jitter:melody', 6, 12),
      harmony: f('jitter:harmony', 0, 6),
      bass: f('jitter:bass', 2, 6),
      rhythm: f('jitter:rhythm', 0, 3),
    },
    swing: {
      enabled: rand01(seed, 'swing:enabled') < 0.6,
      ratio: f('swing:ratio', 0.52, 0.58),
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
      phraseGapMs: f('art:gap', 18, 40),
      minNoteDurSec: 0.03,
    },
    adsr: {
      melody: {
        attackMs: f('adsr:mel:a', 8, 18),
        decayMs: f('adsr:mel:d', 40, 80),
        sustain: 0.75,
        releaseMs: f('adsr:mel:r', 50, 120),
      },
      harmony: {
        attackMs: f('adsr:harm:a', 15, 35),
        decayMs: f('adsr:harm:d', 60, 120),
        sustain: 0.85,
        releaseMs: f('adsr:harm:r', 80, 180),
      },
      bass: {
        attackMs: f('adsr:bass:a', 5, 15),
        decayMs: f('adsr:bass:d', 30, 70),
        sustain: 0.78,
        releaseMs: f('adsr:bass:r', 40, 100),
      },
      rhythm: {
        attackMs: f('adsr:rhythm:a', 2, 8),
        decayMs: f('adsr:rhythm:d', 20, 50),
        sustain: 0.3,
        releaseMs: f('adsr:rhythm:r', 25, 60),
      },
    },
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

/** Build 16-bit PCM WAV buffer for exactly 60 seconds. Deterministic from hash and plan. */
function buildWav(
  seed: string,
  plan: unknown,
  sampleRate: number,
  channels: number
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

    if (HUMANIZE_ENABLED) {
      const params = getPerformanceParams(seed, bpm);

      for (let eventIndex = 0; eventIndex < sorted.length; eventIndex++) {
        const ev = sorted[eventIndex];
        const ch = eventChannel(ev);
        const t0Plan = Number(ev.t0) ?? 0;
        const t1Plan = Number(ev.t1) ?? t0Plan + 0.5;
        const pitch = Number(ev.pitch) ?? 69;
        const velPlan = Math.max(0, Math.min(1, Number(ev.velocity) ?? 0.8));

        // --- C) Micro-timing (conservative) ---
        const jitterMs = params.timingJitterMs[ch];
        const jitterSec = (jitterMs * 0.001) * randSigned(seed, `timing:${ch}:${eventIndex}:${Math.floor(t0Plan / secPerBar)}`);
        let t0 = t0Plan + jitterSec;
        let t1 = t1Plan;

        // Optional swing: delay off-beat 8ths
        if (params.swing.enabled && secPerBeat > 0) {
          const beatInBar = (t0Plan % secPerBar) / secPerBeat;
          const eighth = Math.floor(beatInBar * 2) / 2;
          const isOffEighth = Math.abs(beatInBar - eighth - 0.5) < 0.05;
          if (isOffEighth) {
            const gridDur = secPerBeat * 0.5;
            t0 += (params.swing.ratio - 0.5) * gridDur;
          }
        }
        t0 = Math.max(0, t0);
        const minDur = params.articulation.minNoteDurSec;
        if (t1 - t0 < minDur) t1 = t0 + minDur;

        // --- E) Phrase breathing: shorten end at phrase boundaries ---
        const bar = Math.floor(t0 / secPerBar);
        const phrase = Math.floor(bar / 4);
        const barInPhrase = bar % 4;
        const gapSec = (params.articulation.phraseGapMs * 0.001);
        if (barInPhrase === 3 && (ch === 'melody' || ch === 'harmony')) {
          t1 = Math.max(t0 + minDur, t1 - gapSec);
        }

        // --- D) Velocity dynamics (phrase curve, downbeat, cadence, passing tone, variance) ---
        const phrasePosition = (bar % 16) / 16;
        const phraseSwell = lerp(params.velocity.phraseCurveMin, params.velocity.phraseCurveMax, phrasePosition);
        let vel = velPlan * phraseSwell;

        const beatInBar = (t0Plan % secPerBar) / secPerBeat;
        const isDownbeat = beatInBar < 0.15;
        if (isDownbeat) vel += params.velocity.accentDownbeat;
        if (barInPhrase === 3 && ch === 'melody') vel += params.velocity.cadenceAccent;

        const durPlan = t1Plan - t0Plan;
        const isPassingTone = durPlan < 0.35 && !isDownbeat && Math.abs(beatInBar - 2) > 0.2;
        if (isPassingTone) vel += params.velocity.passingToneReduce;

        const varKey = `vel:${ch}:${eventIndex}:${bar}`;
        vel += randSigned(seed, varKey) * params.velocity.randomVar;
        vel = Math.max(0, Math.min(1, vel));

        // --- F) ADSR per channel ---
        const adsr = params.adsr[ch];
        const durationSec = Math.max(minDur, t1 - t0);
        const attackMs = adsr.attackMs;
        const decayMs = adsr.decayMs;
        const sustain = adsr.sustain;
        const releaseMs = adsr.releaseMs;

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

      // Light deterministic reverb: simple short stereo delay mix (fixed taps)
      const reverbMix = params.spatial.reverbMix;
      if (channels >= 2 && reverbMix > 0) {
        const len = bufL.length;
        const d1 = Math.floor(sampleRate * 0.03);
        const d2 = Math.floor(sampleRate * 0.07);
        const g1 = 0.4 * reverbMix;
        const g2 = 0.25 * reverbMix;
        const outL = new Float32Array(len);
        const outR = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          outL[i] = (bufL[i] ?? 0) + (i >= d1 ? (bufL[i - d1] ?? 0) * g1 : 0) + (i >= d2 ? (bufR[i - d2] ?? 0) * g2 : 0);
          outR[i] = (bufR[i] ?? 0) + (i >= d1 ? (bufR[i - d1] ?? 0) * g1 : 0) + (i >= d2 ? (bufL[i - d2] ?? 0) * g2 : 0);
        }
        for (let i = 0; i < len; i++) {
          bufL[i] = outL[i];
          bufR[i] = outR[i];
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
    for (let i = 0; i < bufL.length; i++) {
      const v = Math.abs(bufL[i]);
      if (v > peak) peak = v;
    }
    const scale = peak > 0.95 ? 0.95 / peak : 1;
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
    const buffer = buildWav(seed, planInput, sampleRate, channels);
    if (process.env.NODE_ENV !== 'production') assertValidWavInDev(buffer);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const durationMs = DURATION_SEC * 1000;
    const sizeBytes = buffer.length;
    return { buffer, sha256, duration_ms: durationMs, size_bytes: sizeBytes };
  } catch {
    const buffer = buildWav('fallback', null, DEFAULT_SAMPLE_RATE, 1);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const durationMs = DURATION_SEC * 1000;
    const sizeBytes = buffer.length;
    return { buffer, sha256, duration_ms: durationMs, size_bytes: sizeBytes };
  }
}
