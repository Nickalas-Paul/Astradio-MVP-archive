/**
 * Basic audio sanity: decode WAV from renderer and assert peak, DC offset, length.
 * Fast, deterministic. Verifies mono path does not double-process (single channel).
 */

import { renderWav60s } from '../audio/wav-renderer';
import type { Plan, EventToken } from '../contracts';

const SAMPLE_RATE = 22050;
const DURATION_SEC = 2;
const RENDERER_DURATION_SEC = 60; // wav-renderer always outputs 60s
const PEAK_MAX = 1.0;
const DC_EPS = 1e-3;
const LENGTH_TOL_SAMPLES = 2;

function makeFixedPlan(): Plan {
  const events: EventToken[] = [
    { t0: 0, t1: 0.5, pitch: 60, velocity: 0.8, channel: 'melody' },
    { t0: 0.5, t1: 1.0, pitch: 64, velocity: 0.7, channel: 'melody' },
  ];
  return {
    id: 'sanity_test',
    featureHash: 'v6',
    durationSec: DURATION_SEC,
    bpm: 120,
    key: 'A minor',
    events,
  };
}

/** Deterministic busy plan: multiple overlapping notes across melody, harmony, bass, rhythm. */
function makeBusyPlan(): Plan {
  const events: EventToken[] = [];
  const bpm = 120;
  const secPerBeat = 60 / bpm;
  for (let bar = 0; bar < 10; bar++) {
    const t0 = bar * 4 * secPerBeat;
    events.push({ t0, t1: t0 + secPerBeat * 2, pitch: 48 + (bar % 12), velocity: 0.75, channel: 'bass' });
    events.push({ t0: t0 + 2 * secPerBeat, t1: t0 + 4 * secPerBeat, pitch: 48 + 7 + (bar % 12), velocity: 0.7, channel: 'bass' });
    for (let beat = 0; beat < 4; beat++) {
      const st = t0 + beat * secPerBeat;
      events.push({ t0: st, t1: st + secPerBeat * 0.5, pitch: 36, velocity: 0.8, channel: 'rhythm' });
      events.push({ t0: st + secPerBeat * 0.5, t1: st + secPerBeat, pitch: 42, velocity: 0.4, channel: 'rhythm' });
    }
    events.push({ t0: t0, t1: t0 + 4 * secPerBeat, pitch: 60 + (bar % 3), velocity: 0.5, channel: 'harmony' });
    events.push({ t0: t0, t1: t0 + 4 * secPerBeat, pitch: 64 + (bar % 3), velocity: 0.45, channel: 'harmony' });
    events.push({ t0: t0, t1: t0 + 4 * secPerBeat, pitch: 67 + (bar % 3), velocity: 0.45, channel: 'harmony' });
    for (let k = 0; k < 4; k++) {
      events.push({ t0: t0 + k * secPerBeat, t1: t0 + (k + 1) * secPerBeat, pitch: 60 + (bar + k) % 7, velocity: 0.7, channel: 'melody' });
    }
  }
  return {
    id: 'sanity_busy',
    featureHash: 'v6',
    durationSec: RENDERER_DURATION_SEC,
    bpm,
    key: 'A minor',
    events,
  };
}

function makeFixedPayload(): { element_dominance: string; aspect_tension: number; hash: string } {
  return { element_dominance: 'earth', aspect_tension: 0.5, hash: 'sanity_fixed' };
}

function decodeWavToFloat(buffer: Buffer): { samples: number[]; numCh: number; sampleRate: number; totalSamples: number } {
  if (buffer.length < 44) throw new Error('WAV too short');
  const numCh = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const dataLen = buffer.readUInt32LE(40);
  const totalSamples = dataLen / (numCh * 2);
  const samples: number[] = [];
  let offset = 44;
  for (let i = 0; i < totalSamples * numCh; i++) {
    const s = buffer.readInt16LE(offset);
    samples.push(s / 32768);
    offset += 2;
  }
  return { samples, numCh, sampleRate, totalSamples };
}

function main(): void {
  const plan = makeFixedPlan();
  const payload = makeFixedPayload();
  const mono = renderWav60s(plan, payload, payload.hash, {
    sampleRate: SAMPLE_RATE,
    channels: 1,
    bitDepth: 16,
  });
  const stereo = renderWav60s(plan, payload, payload.hash, {
    sampleRate: SAMPLE_RATE,
    channels: 2,
    bitDepth: 16,
  });

  let failed = false;

  for (const { label, buffer, channels } of [
    { label: 'mono', buffer: mono.buffer, channels: 1 },
    { label: 'stereo', buffer: stereo.buffer, channels: 2 },
  ]) {
    const { samples, numCh, sampleRate, totalSamples } = decodeWavToFloat(buffer);
    if (numCh !== channels) {
      console.error(`FAIL [${label}]: channel count ${numCh} expected ${channels}`);
      failed = true;
    }
    const expectedSamples = Math.floor(RENDERER_DURATION_SEC * sampleRate) * numCh;
    if (Math.abs(samples.length - expectedSamples) > LENGTH_TOL_SAMPLES * numCh) {
      console.error(`FAIL [${label}]: length ${samples.length} expected ~${expectedSamples}`);
      failed = true;
    }
    let peak = 0;
    for (let j = 0; j < samples.length; j++) {
      const a = Math.abs(samples[j]);
      if (a > peak) peak = a;
    }
    if (peak > PEAK_MAX) {
      console.error(`FAIL [${label}]: peak ${peak.toFixed(4)} > ${PEAK_MAX}`);
      failed = true;
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    if (Math.abs(mean) >= DC_EPS) {
      console.error(`FAIL [${label}]: |mean| ${Math.abs(mean).toExponential(2)} >= ${DC_EPS}`);
      failed = true;
    }
  }

  // Busy plan: peak in (0, 1], |mean| < 1e-3
  const busyPlan = makeBusyPlan();
  const busyPayload = { element_dominance: 'fire', aspect_tension: 0.5, hash: 'sanity_busy_fixed' };
  const busyMono = renderWav60s(busyPlan, busyPayload, busyPayload.hash, {
    sampleRate: SAMPLE_RATE,
    channels: 1,
    bitDepth: 16,
  });
  const busyStereo = renderWav60s(busyPlan, busyPayload, busyPayload.hash, {
    sampleRate: SAMPLE_RATE,
    channels: 2,
    bitDepth: 16,
  });

  for (const { label, buffer, result, channels } of [
    { label: 'busy_mono', buffer: busyMono.buffer, result: busyMono, channels: 1 },
    { label: 'busy_stereo', buffer: busyStereo.buffer, result: busyStereo, channels: 2 },
  ]) {
    const { samples, numCh, sampleRate, totalSamples } = decodeWavToFloat(buffer);
    if (numCh !== channels) {
      console.error(`FAIL [${label}]: channel count ${numCh} expected ${channels}`);
      failed = true;
    }
    const expectedSamples = Math.floor(RENDERER_DURATION_SEC * sampleRate) * numCh;
    if (Math.abs(samples.length - expectedSamples) > LENGTH_TOL_SAMPLES * numCh) {
      console.error(`FAIL [${label}]: length ${samples.length} expected ~${expectedSamples}`);
      failed = true;
    }
    let peak = 0;
    for (let j = 0; j < samples.length; j++) {
      const a = Math.abs(samples[j]);
      if (a > peak) peak = a;
    }
    if (peak > PEAK_MAX) {
      console.error(`FAIL [${label}]: peak ${peak.toFixed(4)} > ${PEAK_MAX}`);
      failed = true;
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    if (Math.abs(mean) >= DC_EPS) {
      console.error(`FAIL [${label}]: |mean| ${Math.abs(mean).toExponential(2)} >= ${DC_EPS}`);
      failed = true;
    }
    let peakFromSamples = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = Math.abs(samples[i]);
      if (a > peakFromSamples) peakFromSamples = a;
    }
    if (peakFromSamples <= 0 || peakFromSamples > 1.0) {
      console.error(`FAIL [${label}]: peak ${peakFromSamples.toFixed(4)} not in (0, 1]`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log('OK: audio sanity (peak, DC, length, channel count, busy plan)');
}

main();
