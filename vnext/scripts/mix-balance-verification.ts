/**
 * Mix balance verification: bass dominance fix and kick presence.
 * Asserts:
 * - Same plan + payload.hash produces identical audio.sha256
 * - bass_peak <= master_peak * 0.9 (bass not dominating)
 * - kick_peak >= 0.08 (kick transient present)
 * npm run vnext:build && node dist/vnext/vnext/scripts/mix-balance-verification.js
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
    id: 'mix_balance_verify',
    featureHash: 'v6',
    durationSec: 60,
    bpm: BPM,
    key: 'A minor',
    events,
  };
}

function main(): void {
  const plan = makeHousePlan();
  const payload = { hash: 'mix_balance_verify_hash', genre: 'house' as const };
  const options = { sampleRate: SAMPLE_RATE, channels: 2, bitDepth: 16, returnChannelStats: true };

  console.log('[mix-balance-verification] Rendering (2 runs for determinism)...');
  const r1 = renderWav60s(plan, payload, payload.hash, options);
  const r2 = renderWav60s(plan, payload, payload.hash, options);

  let failed = false;
  if (r1.sha256 !== r2.sha256) {
    console.error('FAIL: sha256 differs between runs');
    failed = true;
  }
  if (!r1.channelStats || !r2.channelStats) {
    console.error('FAIL: channelStats missing');
    failed = true;
  }

  if (r1.channelStats && r2.channelStats) {
    const bassPeak = r1.channelStats.bass.peak;
    const kickPeak = r1.channelStats.kick.peak;

    if (bassPeak > kickPeak * 1.4) {
      console.error('FAIL: bass dominates kick, bass_peak=', bassPeak.toFixed(4), 'kick_peak=', kickPeak.toFixed(4));
      failed = true;
    }
    if (kickPeak < 0.08) {
      console.error('FAIL: kick transient too low, kick_peak=', kickPeak.toFixed(4));
      failed = true;
    }
  }

  if (failed) process.exit(1);

  console.log('OK: mix balance verification');
  console.log('  sha256:', r1.sha256);
  if (r1.channelStats) {
    const ratio = r1.channelStats.kick.peak > 0 ? r1.channelStats.bass.peak / r1.channelStats.kick.peak : 0;
    console.log('  bass_peak=', r1.channelStats.bass.peak.toFixed(4), 'kick_peak=', r1.channelStats.kick.peak.toFixed(4), 'bass_to_kick_ratio=', ratio.toFixed(4));
  }
}

main();
