/**
 * Reverb send verification (Instrumentation v2).
 * Asserts:
 * - bass_reverb_send == 0
 * - kick_reverb_send == 0
 * - harmony_reverb_send > 0
 * - render twice gives identical audio.sha256
 * npm run vnext:build && node dist/vnext/vnext/scripts/reverb-send-verification.js
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
    id: 'reverb_send_verify',
    featureHash: 'v6',
    durationSec: 60,
    bpm: BPM,
    key: 'A minor',
    events,
  };
}

function main(): void {
  const plan = makeHousePlan();
  const payload = { hash: 'reverb_send_verify_hash', genre: 'house' as const };
  const options = { sampleRate: SAMPLE_RATE, channels: 2, bitDepth: 16, returnFxRoutingStats: true };

  console.log('[reverb-send-verification] Rendering (2 runs for determinism)...');
  const r1 = renderWav60s(plan, payload, payload.hash, options);
  const r2 = renderWav60s(plan, payload, payload.hash, options);

  let failed = false;
  if (r1.sha256 !== r2.sha256) {
    console.error('FAIL: sha256 differs between runs');
    failed = true;
  }
  if (!r1.fxRoutingStats || !r2.fxRoutingStats) {
    console.error('FAIL: fxRoutingStats missing');
    failed = true;
  }

  const amounts = r1.fxRoutingStats?.reverbSendAmounts;
  if (amounts) {
    if (amounts.bass > 0.001) {
      console.error('FAIL: bass_reverb_send != 0, got', amounts.bass.toFixed(6));
      failed = true;
    }
    if (amounts.kick > 0.001) {
      console.error('FAIL: kick_reverb_send != 0, got', amounts.kick.toFixed(6));
      failed = true;
    }
    if (amounts.harmony <= 0) {
      console.error('FAIL: harmony_reverb_send must be > 0, got', amounts.harmony.toFixed(6));
      failed = true;
    }
  } else {
    console.error('FAIL: reverbSendAmounts missing');
    failed = true;
  }

  if (failed) process.exit(1);

  console.log('OK: reverb send verification');
  console.log('  sha256:', r1.sha256);
  if (amounts) {
    console.log('  reverb_send: kick=', amounts.kick.toFixed(4), 'bass=', amounts.bass.toFixed(4), 'harmony=', amounts.harmony.toFixed(4));
  }
}

main();
