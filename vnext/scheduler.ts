// vnext/scheduler.ts - Plan → Audio adapter
import type { Plan, EventToken } from './contracts';

export interface AudioEvent {
  time: number;
  note: string;
  duration: string;
  velocity: number;
  channel: string;
}

export interface RenderResult {
  duration: number;
  eventCount: number;
  channels: string[];
  audioBuffer?: ArrayBuffer;
}

/**
 * Convert vNext Plan events to Tone.js-compatible format
 */
export function planToToneEvents(plan: Plan): AudioEvent[] {
  const events: AudioEvent[] = [];
  
  for (const event of plan.events) {
    // Convert MIDI pitch to note name (simplified)
    const note = midiToNote(event.pitch);
    
    // Convert time to Tone.js format (seconds)
    const time = event.t0;
    const duration = (event.t1 - event.t0).toFixed(3);
    
    // Convert velocity (0-1 to 0-127)
    const velocity = Math.round(event.velocity * 127);
    
    events.push({
      time,
      note,
      duration,
      velocity,
      channel: event.channel
    });
  }
  
  return events.sort((a, b) => a.time - b.time);
}

/**
 * Convert MIDI pitch number to note name
 */
function midiToNote(pitch: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = pitch % 12;
  return `${notes[noteIndex]}${octave}`;
}

/**
 * Validate plan for audio rendering
 */
export function validatePlanForAudio(plan: Plan): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!plan.events || plan.events.length === 0) {
    issues.push('No events in plan');
  }
  
  if (plan.durationSec <= 0) {
    issues.push('Invalid duration');
  }
  
  // Check for required channels
  const channels = new Set(plan.events.map(e => e.channel));
  const requiredChannels = ['melody', 'harmony'];
  for (const req of requiredChannels) {
    if (!channels.has(req as any)) {
      issues.push(`Missing required channel: ${req}`);
    }
  }
  
  // Check for finite values
  for (let i = 0; i < plan.events.length; i++) {
    const event = plan.events[i];
    if (!Number.isFinite(event.t0) || !Number.isFinite(event.t1) || 
        !Number.isFinite(event.pitch) || !Number.isFinite(event.velocity)) {
      issues.push(`Non-finite values in event ${i}`);
      break;
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Generate audio metadata for logging
 */
export function generateRenderMetadata(plan: Plan, audioEvents: AudioEvent[]): any {
  const channels = new Set(plan.events.map(e => e.channel));
  const pitchRange = {
    min: Math.min(...plan.events.map(e => e.pitch)),
    max: Math.max(...plan.events.map(e => e.pitch))
  };
  
  return {
    planId: plan.id,
    source: 'vnext',
    duration: plan.durationSec,
    eventCount: plan.events.length,
    toneEventCount: audioEvents.length,
    channels: Array.from(channels),
    pitchRange,
    bpm: plan.bpm,
    key: plan.key
  };
}
