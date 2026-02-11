/**
 * Instrumentation Layer v1 verification: determinism + basic spectral sanity.
 * Uses a house-style plan (kick, hat, clap, bass, harmony, melody) and asserts:
 * - Same plan + payload.hash produces identical audio.sha256
 * - Peak and RMS within reasonable bounds
 * Run with VNEXT_INSTRUMENTATION_DEBUG=1 to print kick count, duck stats.
 * npm run vnext:build && node dist/vnext/vnext/scripts/instrumentation-verification.js
 */

import { renderWav60s } from '../audio/wav-renderer';
import type { Plan, EventToken } from '../contracts';

const SAMPLE_RATE = 22050;
const BPM = 120;
const secPerBeat = 60 / BPM;
const secPerBar = secPerBeat * 4;

function makeHousePlan(): Plan {
  const events: EventToken[] = [];
  for (let bar = 0; bar < 4; bar++) {
    const barStart = bar * secPerBar;
    events.push({ t0: barStart + 0, t1: barStart + 0.25, pitch: 36, velocity: 0.85, channel: 'rhythm' });
    events.push({ t0: barStart + secPerBeat, t1: barStart + secPerBeat + 0.25, pitch: 36, velocity: 0.8, channel: 'rhythm' });
    events.push({ t0: barStart + 2 * secPerBeat, t1: barStart + 2 * secPerBeat + 0.25, pitch: 36, velocity: 0.8, channel: 'rhythm' });
    events.push({ t0: barStart + 3 * secPerBeat, t1: barStart + 3 * secPerBeat + 0.25, pitch: 36, velocity: 0.75, channel: 'rhythm' });
    events.push({ t0: barStart + 0.5 * secPerBeat, t1: barStart + 0.75 * secPerBeat, pitch: 42, velocity: 0.4, channel: 'rhythm' });
    events.push({ t0: barStart + 1.5 * secPerBeat, t1: barStart + 1.75 * secPerBeat, pitch: 42, velocity: 0.4, channel: 'rhythm' });
    events.push({ t0: barStart + 2.5 * secPerBeat, t1: barStart + 2.75 * secPerBeat, pitch: 42, velocity: 0.4, channel: 'rhythm' });
    events.push({ t0: barStart + 3.5 * secPerBeat, t1: barStart + 3.75 * secPerBeat, pitch: 42, velocity: 0.4, channel: 'rhythm' });
    events.push({ t0: barStart + 1 * secPerBeat, t1: barStart + 1.25 * secPerBeat, pitch: 38, velocity: 0.65, channel: 'rhythm' });
    events.push({ t0: barStart + 3 * secPerBeat, t1: barStart + 3.25 * secPerBeat, pitch: 38, velocity: 0.6, channel: 'rhythm' });
    events.push({ t0: barStart, t1: barStart + 0.5, pitch: 45, velocity: 0.7, channel: 'bass' });
    events.push({ t0: barStart + 2 * secPerBeat, t1: barStart + 2.5 * secPerBeat, pitch: 43, velocity: 0.65, channel: 'bass' });
    events.push({ t0: barStart, t1: barStart + 0.5, pitch: 60, velocity: 0.6, channel: 'harmony' });
    events.push({ t0: barStart, t1: barStart + 0.3, pitch: 67, velocity: 0.5, channel: 'melody' });
  }
  events.sort((a, b) => a.t0 - b.t0 || (a.channel as string).localeCompare(b.channel as string) || a.pitch - b.pitch);
  return {
    id: 'instrumentation_verify',
    featureHash: 'v6',
    durationSec: 60,
    bpm: BPM,
    key: 'A minor',
    events,
  };
}

function main(): void {
  const plan = makeHousePlan();
  const payload = { hash: 'instrumentation_verify_hash', genre: 'house' as const };
  const options = { sampleRate: SAMPLE_RATE, channels: 2, bitDepth: 16 };

  console.log('[instrumentation-verification] Rendering house plan (2 runs for determinism)...');
  const r1 = renderWav60s(plan, payload, payload.hash, options);
  const r2 = renderWav60s(plan, payload, payload.hash, options);

  let failed = false;
  if (r1.sha256 !== r2.sha256) {
    console.error('FAIL: sha256 differs');
    failed = true;
  }
  if (r1.buffer.length !== r2.buffer.length) {
    console.error('FAIL: buffer length differs');
    failed = true;
  }

  const headerLen = 44;
  const numSamples = (r1.buffer.length - headerLen) / 4;
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < numSamples; i++) {
    const s = r1.buffer.readInt16LE(headerLen + i * 4) / 32767;
    if (Math.abs(s) > peak) peak = Math.abs(s);
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / numSamples);
  if (peak < 0.01 || peak > 1.5) {
    console.error('FAIL: peak out of bounds:', peak);
    failed = true;
  }
  if (rms < 0.001) {
    console.error('FAIL: RMS too low (silence?)', rms);
    failed = true;
  }

  if (failed) process.exit(1);

  console.log('OK: instrumentation verification');
  console.log('  sha256:', r1.sha256);
  console.log('  peak:', peak.toFixed(4), 'RMS:', rms.toFixed(4));
}

main();
