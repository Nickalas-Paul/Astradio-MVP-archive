/**
 * Minimal deterministic WAV renderer: plan + payload hash → 60s 16-bit PCM WAV.
 * No external type imports; never throws in normal operation (fallback to simple tone).
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

/** Deterministic 0..1 from string seed (no randomness). */
function seedFloat(seed: string, index: number): number {
  let h = 0;
  const s = seed + String(index);
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h & h;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
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
  const key = typeof planObj?.key === 'string' ? planObj.key : 'C';

  const toInt16 = (x: number) => Math.max(-32768, Math.min(32767, Math.floor(x * 32767)));

  if (events && events.length > 0) {
    // Simple sine tones from plan events (t0, t1, pitch, velocity)
    const bufL = new Float32Array(Math.floor(DURATION_SEC * sampleRate));
    const bufR = channels >= 2 ? new Float32Array(Math.floor(DURATION_SEC * sampleRate)) : bufL;
    const sorted = [...events].sort((a, b) => (Number(a.t0) || 0) - (Number(b.t0) || 0));
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
    // Fallback: fixed A=440 with seeded variation (frequency and amplitude)
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
    const seed = (typeof hash === 'string' && hash) || (payloadInput && typeof (payloadInput as Record<string, unknown>).hash === 'string' ? (payloadInput as Record<string, unknown>).hash as string : '') || (planInput && typeof (planInput as Record<string, unknown>).featureHash === 'string' ? (planInput as Record<string, unknown>).featureHash as string : '') || 'default';
    const sampleRate = Math.max(8000, Math.min(48000, options?.sampleRate ?? DEFAULT_SAMPLE_RATE));
    const channels = options?.channels === 2 ? 2 : 1;
    const buffer = buildWav(seed, planInput, sampleRate, channels);
    if (process.env.NODE_ENV !== 'production') assertValidWavInDev(buffer);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const durationMs = DURATION_SEC * 1000;
    const sizeBytes = buffer.length;
    return { buffer, sha256, duration_ms: durationMs, size_bytes: sizeBytes };
  } catch {
    // Fallback: 60s 440 Hz tone, still valid WAV (fixed params so this never throws)
    const buffer = buildWav('fallback', null, DEFAULT_SAMPLE_RATE, 1);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const durationMs = DURATION_SEC * 1000;
    const sizeBytes = buffer.length;
    return { buffer, sha256, duration_ms: durationMs, size_bytes: sizeBytes };
  }
}
