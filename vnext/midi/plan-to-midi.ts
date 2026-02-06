/**
 * Plan → MIDI adapter (deterministic)
 * Converts canonical Plan to MIDI file bytes using @tonejs/midi
 * MIDI is a deterministic serialization of the canonical Plan, not a generative layer.
 */

import { Midi } from '@tonejs/midi';
import * as crypto from 'crypto';
import type { Plan, EventToken } from '../contracts';

const PPQ = 480; // Pulses per quarter note (fixed, do not change)

/**
 * Round time values to 1ms precision (same as plan hashing)
 */
function roundTime(t: number): number {
  return Math.round(t * 1000) / 1000;
}

/**
 * Convert seconds to MIDI ticks using bpm + PPQ
 */
function secondsToTicks(seconds: number, bpm: number, ppq: number): number {
  const beatsPerSecond = bpm / 60;
  const ticksPerSecond = beatsPerSecond * ppq;
  return Math.round(roundTime(seconds) * ticksPerSecond);
}

/**
 * Convert Plan to MIDI base64 + metadata
 * Deterministic: same plan always produces same MIDI
 */
export function planToMidiBase64(plan: Plan): {
  base64: string;
  sha256: string;
  ppq: number;
  tracks: number;
  bytes: number;
} {
  // Create new MIDI file (defaults to PPQ=480)
  const midi = new Midi();
  
  // Set tempo from plan.bpm
  midi.header.setTempo(plan.bpm);

  // Group events by channel to create one track per channel
  const channelGroups = new Map<string, EventToken[]>();
  for (const ev of plan.events) {
    const channel = ev.channel;
    if (!channelGroups.has(channel)) {
      channelGroups.set(channel, []);
    }
    channelGroups.get(channel)!.push(ev);
  }

  // Create one deterministic track per Plan.channel
  // Track naming must be stable and predictable
  const channelOrder = ['melody', 'harmony', 'bass', 'rhythm'] as const;
  const tracksCreated: string[] = [];

  for (const channel of channelOrder) {
    const events = channelGroups.get(channel);
    if (!events || events.length === 0) continue;

    // Create track with stable name
    const track = midi.addTrack();
    track.name = channel; // Stable track naming

    // Sort events by canonical ordering (same as plan hashing)
    const sortedEvents = [...events].sort((a, b) => {
      const t0Diff = roundTime(a.t0) - roundTime(b.t0);
      if (t0Diff !== 0) return t0Diff;
      const pitchDiff = a.pitch - b.pitch;
      if (pitchDiff !== 0) return pitchDiff;
      return roundTime(a.t1) - roundTime(b.t1);
    });

    // Add notes to track
    for (const ev of sortedEvents) {
      // Convert timing: plan.t0/t1 (seconds) → MIDI ticks using bpm + PPQ
      const startTicks = secondsToTicks(ev.t0, plan.bpm, PPQ);
      const durationTicks = secondsToTicks(ev.t1 - ev.t0, plan.bpm, PPQ);

      // Pitch: Plan.pitch → MIDI note number directly (clamp to valid range)
      const pitch = Math.max(0, Math.min(127, Math.round(ev.pitch)));

      // Velocity: Plan.velocity ∈ [0,1] → MIDI velocity ∈ [1,127] → normalize to [0,1] for @tonejs/midi
      const velocityMidi = Math.max(1, Math.min(127, Math.round(ev.velocity * 127)));
      const velocityNormalized = velocityMidi / 127; // @tonejs/midi expects 0-1

      if (durationTicks > 0 && pitch >= 0 && pitch <= 127) {
        // Add note using ticks (more precise than time for deterministic encoding)
        track.addNote({
          midi: pitch,
          ticks: startTicks,
          durationTicks: durationTicks,
          velocity: velocityNormalized
        });
      }
    }

    tracksCreated.push(channel);
  }

  // Encode MIDI to binary
  const midiBytes = midi.toArray();
  
  // Compute SHA256 from raw MIDI bytes (before base64 encoding)
  const sha256 = crypto.createHash('sha256').update(midiBytes).digest('hex');
  
  // Convert to base64
  const base64 = Buffer.from(midiBytes).toString('base64');

  return {
    base64,
    sha256,
    ppq: PPQ,
    tracks: tracksCreated.length,
    bytes: midiBytes.length
  };
}
