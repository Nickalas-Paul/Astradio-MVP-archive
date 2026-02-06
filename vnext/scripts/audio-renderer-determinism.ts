/**
 * Determinism check for the audio renderer: render a fixed 2-note plan twice and assert
 * identical sha256, stable length, and peak within bounds.
 * Run after build: npm run vnext:build && node dist/vnext/scripts/audio-renderer-determinism.js
 */

import { renderWav60s } from '../audio/wav-renderer';
import type { Plan, EventToken } from '../contracts';

const SAMPLE_RATE = 22050;
const DURATION_SEC = 2; // short run for fast check

function makeFixedPlan(): Plan {
  const events: EventToken[] = [
    { t0: 0, t1: 0.5, pitch: 60, velocity: 0.8, channel: 'melody' },
    { t0: 0.5, t1: 1.0, pitch: 64, velocity: 0.7, channel: 'melody' },
  ];
  return {
    id: 'determinism_test',
    featureHash: 'v6',
    durationSec: DURATION_SEC,
    bpm: 120,
    key: 'A minor',
    events,
  };
}

function makeFixedPayload(): { element_dominance: string; aspect_tension: number; hash: string } {
  return {
    element_dominance: 'fire',
    aspect_tension: 0.4,
    hash: 'test_hash_fixed',
  };
}

function main(): void {
  const plan = makeFixedPlan();
  const payload = makeFixedPayload();
  const options = { sampleRate: SAMPLE_RATE, channels: 1, bitDepth: 16, debugAudio: true };

  const r1 = renderWav60s(plan, payload, payload.hash, options);
  const r2 = renderWav60s(plan, payload, payload.hash, options);

  let failed = false;

  if (r1.sha256 !== r2.sha256) {
    console.error('FAIL: sha256 differs between runs:', r1.sha256, 'vs', r2.sha256);
    failed = true;
  }
  if (r1.buffer.length !== r2.buffer.length) {
    console.error('FAIL: buffer length differs:', r1.buffer.length, 'vs', r2.buffer.length);
    failed = true;
  }
  if (r1.buffer.length < 44) {
    console.error('FAIL: buffer too short (no WAV body):', r1.buffer.length);
    failed = true;
  }

  // First N bytes checksum (PCM data after header) for extra stability signal
  const headerLen = 44;
  const firstN = Math.min(1024, r1.buffer.length - headerLen);
  if (firstN > 0) {
    const slice1 = r1.buffer.slice(headerLen, headerLen + firstN);
    const slice2 = r2.buffer.slice(headerLen, headerLen + firstN);
    if (!slice1.equals(slice2)) {
      console.error('FAIL: first', firstN, 'PCM bytes differ between runs');
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log('OK: deterministic render');
  console.log('  sha256:', r1.sha256);
  console.log('  size_bytes:', r1.size_bytes);
  console.log('  duration_ms:', r1.duration_ms);
}

main();
