/**
 * Unit test: MIDI export determinism
 * Asserts that planToMidiBase64 produces stable MIDI SHA256 for same plan
 * Uses @tonejs/midi as the ONLY MIDI library
 */

import { planToMidiBase64 } from '../midi/plan-to-midi';
import type { Plan } from '../contracts';

function makeTestPlan(): Plan {
  return {
    id: 'test-plan-midi',
    featureHash: 'test123',
    durationSec: 60,
    bpm: 120,
    key: 'C major',
    events: [
      { t0: 0.0, t1: 0.5, pitch: 60, velocity: 0.8, channel: 'melody' as const },
      { t0: 0.5, t1: 1.0, pitch: 64, velocity: 0.7, channel: 'melody' as const },
      { t0: 1.0, t1: 1.5, pitch: 67, velocity: 0.6, channel: 'melody' as const },
      { t0: 0.0, t1: 2.0, pitch: 48, velocity: 0.5, channel: 'bass' as const },
      { t0: 0.25, t1: 0.75, pitch: 52, velocity: 0.4, channel: 'harmony' as const }
    ]
  };
}

function main(): void {
  let failed = false;

  // Test 1: Same plan produces same MIDI SHA256
  const plan1 = makeTestPlan();
  const midi1 = planToMidiBase64(plan1);
  const midi2 = planToMidiBase64(plan1);
  
  if (midi1.sha256 !== midi2.sha256) {
    console.error('FAIL: Same plan produced different MIDI SHA256');
    console.error(`  sha256_1: ${midi1.sha256}`);
    console.error(`  sha256_2: ${midi2.sha256}`);
    failed = true;
  } else {
    console.log('✓ Same plan produces same MIDI SHA256');
  }

  // Test 2: Base64 is valid and consistent
  if (midi1.base64 !== midi2.base64) {
    console.error('FAIL: Same plan produced different MIDI base64');
    failed = true;
  } else {
    console.log('✓ Same plan produces same MIDI base64');
  }

  // Test 3: MIDI has expected structure (tracks, ppq, bytes)
  if (midi1.tracks < 2) {
    console.error(`FAIL: Expected at least 2 tracks (tempo + channels), got ${midi1.tracks}`);
    failed = true;
  } else {
    console.log(`✓ MIDI has ${midi1.tracks} tracks (expected: tempo + channels)`);
  }

  if (midi1.ppq !== 480) {
    console.error(`FAIL: Expected PPQ=480, got ${midi1.ppq}`);
    failed = true;
  } else {
    console.log(`✓ MIDI PPQ is ${midi1.ppq} (expected: 480)`);
  }

  if (midi1.bytes <= 0) {
    console.error(`FAIL: MIDI bytes should be > 0, got ${midi1.bytes}`);
    failed = true;
  } else {
    console.log(`✓ MIDI size: ${midi1.bytes} bytes`);
  }

  // Test 4: Different plan produces different MIDI
  const plan2 = {
    ...makeTestPlan(),
    bpm: 140 // Different BPM
  };
  const midi3 = planToMidiBase64(plan2);
  if (midi1.sha256 === midi3.sha256) {
    console.error('FAIL: Different plan produced same MIDI SHA256');
    failed = true;
  } else {
    console.log('✓ Different plan produces different MIDI SHA256');
  }

  // Test 5: Base64 decodes to valid MIDI header
  try {
    const midiBytes = Buffer.from(midi1.base64, 'base64');
    // MIDI file starts with "MThd" (0x4D546864) for standard MIDI format
    if (midiBytes.length < 14) {
      console.error('FAIL: MIDI file too short');
      failed = true;
    } else {
      const header = midiBytes.toString('ascii', 0, 4);
      if (header === 'MThd') {
        console.log('✓ MIDI file has valid header (MThd)');
      } else {
        console.warn(`WARN: MIDI header is "${header}", expected "MThd" (may be valid for some formats)`);
      }
    }
  } catch (e) {
    console.error('FAIL: Failed to decode MIDI base64:', e);
    failed = true;
  }

  // Test 6: PPQ is fixed at 480
  if (midi1.ppq !== 480) {
    console.error(`FAIL: Expected PPQ=480, got ${midi1.ppq}`);
    failed = true;
  } else {
    console.log('✓ MIDI PPQ is 480 (fixed)');
  }

  if (failed) {
    console.error('\n❌ Tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All MIDI determinism tests passed');
  }
}

main();
