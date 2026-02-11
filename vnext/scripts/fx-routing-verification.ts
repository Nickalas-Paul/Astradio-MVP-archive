/**
 * FX routing verification: bass reverb fix.
 * Asserts:
 * - Same plan + payload.hash produces identical audio.sha256
 * - bass_send (room, plate, delay) near zero
 * - reverb_return_lowband_rms below threshold (no bass bloom in reverb)
 * npm run vnext:build && node dist/vnext/vnext/scripts/fx-routing-verification.js
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
    id: 'fx_routing_verify',
    featureHash: 'v6',
    durationSec: 60,
    bpm: BPM,
    key: 'A minor',
    events,
  };
}

function main(): void {
  const plan = makeHousePlan();
  const payload = { hash: 'fx_routing_verify_hash', genre: 'house' as const };
  const options = { sampleRate: SAMPLE_RATE, channels: 2, bitDepth: 16, returnFxRoutingStats: true };

  console.log('[fx-routing-verification] Rendering (2 runs for determinism)...');
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

  if (r1.fxRoutingStats && r2.fxRoutingStats) {
    const { bass_send_room, bass_send_plate, bass_send_delay, reverb_return_lowband_rms } = r1.fxRoutingStats;

    const bassSendMax = Math.max(bass_send_room, bass_send_plate, bass_send_delay);
    if (bassSendMax > 0.001) {
      console.error('FAIL: bass reverb send too high', bass_send_room, bass_send_plate, bass_send_delay);
      failed = true;
    }
    if (reverb_return_lowband_rms > 0.008) {
      console.error('FAIL: reverb return lowband RMS too high:', reverb_return_lowband_rms.toFixed(6));
      failed = true;
    }
  }

  if (failed) process.exit(1);

  console.log('OK: fx routing verification');
  console.log('  sha256:', r1.sha256);
  if (r1.fxRoutingStats) {
    const s = r1.fxRoutingStats;
    console.log('  bass_send room=', s.bass_send_room.toFixed(6), 'plate=', s.bass_send_plate.toFixed(6), 'delay=', s.bass_send_delay.toFixed(6));
    console.log('  reverb_return_lowband_rms=', s.reverb_return_lowband_rms.toFixed(6));
  }
}

main();
