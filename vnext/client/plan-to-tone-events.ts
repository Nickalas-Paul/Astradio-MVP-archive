/**
 * Browser-safe Plan → Tone.js events converter
 * NO Node.js imports (no fs, path, crypto from node)
 * Pure TypeScript that works in browser/Next client bundle
 */

import type { Plan, EventToken } from '../contracts';

export interface ToneEvent {
  time: number;
  note: string;
  duration: string;
  velocity: number;
  channel: string;
}

/**
 * Convert Plan events to Tone.js-compatible format
 * Browser-safe: no Node.js dependencies
 */
export function planToToneEvents(plan: Plan): ToneEvent[] {
  const events: ToneEvent[] = [];
  
  for (const event of plan.events) {
    // Convert MIDI pitch to note name
    const note = midiToNote(event.pitch);
    
    // Time in seconds (Tone.js uses seconds)
    const time = event.t0;
    const duration = `${event.t1 - event.t0}s`;
    
    // Velocity: keep 0-1 range (Tone.js accepts 0-1)
    const velocity = Math.max(0, Math.min(1, event.velocity));
    
    events.push({
      time,
      note,
      duration,
      velocity,
      channel: event.channel
    });
  }
  
  // Sort by time for Tone.js scheduling
  return events.sort((a, b) => a.time - b.time);
}

/**
 * Convert MIDI pitch number to note name (C4, D#5, etc.)
 */
function midiToNote(pitch: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = Math.round(pitch) % 12;
  return `${notes[noteIndex]}${octave}`;
}
