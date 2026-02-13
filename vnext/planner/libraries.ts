/**
 * Expanded libraries for novelty melody generation.
 * 30-60 chord progressions, 12 bassline patterns, 50 hook motifs.
 * All selections seeded from payload.hash + snapshot/features for deterministic variation.
 */

import type { ElementBlend, MotionProfile } from '../astro/guidance';
import type { EphemerisSnapshot } from '../contracts';

/** One-bar hook: pos16 0–15, degree -1 = rest (no note). At least one dur16 >= 6 (breath). */
export type HookNote = { pos16: number; degree: number; dur16: number };
export type Hook = HookNote[];

/** Chord progression: 4 or 8 bars, roots in MIDI (A=57), triads as semitone offsets from root. */
export interface ChordProgression {
  id: number;
  bars: number; // 4 or 8
  roots: number[]; // MIDI root per bar
  triads: [number, number, number][]; // Triad shape per bar (semitone offsets from root)
  extensions?: number[][]; // Optional: extensions per bar (6, 7, 9 as semitone offsets)
  family: 'diatonic' | 'modal' | 'secondary' | 'pedal'; // Progression family
  brightness: number; // 0-1, for element-driven selection
}

/** Bassline pattern: 1-2 bars, defined as beat positions and scale degrees. */
export interface BasslinePattern {
  id: number;
  bars: number; // 1 or 2
  events: Array<{ beat: number; degree: number; durBeats: number; velocity: number }>;
  style: 'offbeat' | 'rolling' | 'syncopated' | 'sustained' | 'walking' | 'pedal';
}

/** Hook motif: 1-2 bars, scale degrees + rhythmic grid positions. */
export interface HookMotif {
  id: number;
  bars: number; // 1 or 2
  notes: HookNote[];
  family: 'ascending' | 'descending' | 'arc' | 'call-response' | 'repetitive' | 'ornamental';
  density: number; // 0-1, for cluster density influence
}

/**
 * Deterministic PRNG from seed + key (no Math.random)
 */
function hashU32(seed: string, key: string): number {
  let h = 0;
  const s = seed + '\0' + key;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h & h;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function rand01(seed: string, key: string): number {
  return hashU32(seed, key) / 0x100000000;
}

function randInt(seed: string, key: string, max: number): number {
  return Math.floor(rand01(seed, key) * max);
}

/**
 * Expanded chord progressions library (30-60 house-usable progressions)
 */
const CHORD_PROGRESSIONS: ChordProgression[] = [
  // Diatonic loops (i-vi-iv-V, i-iv-V-vi, etc.)
  { id: 0, bars: 4, roots: [57, 53, 52, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.3 },
  { id: 1, bars: 4, roots: [57, 50, 52, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.4 },
  { id: 2, bars: 4, roots: [57, 52, 50, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.35 },
  { id: 3, bars: 4, roots: [57, 53, 50, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.45 },
  { id: 4, bars: 4, roots: [57, 50, 53, 57], triads: [[0,3,7],[0,3,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.4 },
  { id: 5, bars: 4, roots: [57, 48, 50, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.5 },
  { id: 6, bars: 4, roots: [57, 55, 52, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.4 },
  { id: 7, bars: 4, roots: [57, 52, 55, 57], triads: [[0,3,7],[0,3,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.45 },
  { id: 8, bars: 4, roots: [57, 53, 55, 57], triads: [[0,3,7],[0,4,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.5 },
  { id: 9, bars: 4, roots: [57, 50, 55, 57], triads: [[0,3,7],[0,3,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.45 },
  
  // Extended diatonic (8 bars)
  { id: 10, bars: 8, roots: [57, 53, 52, 57, 50, 52, 55, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7],[0,3,7],[0,3,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.4 },
  { id: 11, bars: 8, roots: [57, 50, 52, 57, 53, 50, 55, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7],[0,4,7],[0,3,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.45 },
  { id: 12, bars: 8, roots: [57, 52, 50, 57, 48, 50, 52, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7],[0,4,7],[0,3,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.35 },
  
  // Modal interchange (borrowed chords)
  { id: 13, bars: 4, roots: [57, 58, 52, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'modal', brightness: 0.6 }, // bII
  { id: 14, bars: 4, roots: [57, 60, 52, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'modal', brightness: 0.65 }, // bIII
  { id: 15, bars: 4, roots: [57, 53, 61, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'modal', brightness: 0.55 }, // bVI
  { id: 16, bars: 4, roots: [57, 50, 58, 57], triads: [[0,3,7],[0,3,7],[0,4,7],[0,3,7]], family: 'modal', brightness: 0.6 },
  { id: 17, bars: 4, roots: [57, 58, 50, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'modal', brightness: 0.65 },
  
  // Secondary dominants (limited)
  { id: 18, bars: 4, roots: [57, 53, 64, 52, 57], triads: [[0,3,7],[0,4,7],[0,4,7],[0,3,7],[0,3,7]], family: 'secondary', brightness: 0.7 }, // V/iv
  { id: 19, bars: 4, roots: [57, 50, 61, 55, 57], triads: [[0,3,7],[0,3,7],[0,4,7],[0,4,7],[0,3,7]], family: 'secondary', brightness: 0.75 }, // V/vi
  
  // Pedal variations
  { id: 20, bars: 4, roots: [57, 57, 52, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7]], family: 'pedal', brightness: 0.3 }, // i-i-iv-i
  { id: 21, bars: 4, roots: [57, 57, 50, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7]], family: 'pedal', brightness: 0.35 }, // i-i-vi-i
  { id: 22, bars: 4, roots: [57, 57, 53, 57], triads: [[0,3,7],[0,3,7],[0,4,7],[0,3,7]], family: 'pedal', brightness: 0.4 }, // i-i-vi-i
  
  // More diatonic variations
  { id: 23, bars: 4, roots: [57, 48, 50, 52, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.5 },
  { id: 24, bars: 4, roots: [57, 55, 53, 50, 57], triads: [[0,3,7],[0,4,7],[0,4,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.55 },
  { id: 25, bars: 4, roots: [57, 52, 48, 50, 57], triads: [[0,3,7],[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.45 },
  { id: 26, bars: 4, roots: [57, 50, 48, 52, 57], triads: [[0,3,7],[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.4 },
  { id: 27, bars: 4, roots: [57, 53, 48, 55, 57], triads: [[0,3,7],[0,4,7],[0,4,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.6 },
  { id: 28, bars: 4, roots: [57, 55, 50, 53, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.5 },
  { id: 29, bars: 4, roots: [57, 48, 53, 52, 57], triads: [[0,3,7],[0,4,7],[0,4,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.45 },
  
  // Extended progressions with extensions
  { id: 30, bars: 4, roots: [57, 53, 52, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], extensions: [[],[9],[],[9]], family: 'diatonic', brightness: 0.5 },
  { id: 31, bars: 4, roots: [57, 50, 52, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7]], extensions: [[],[],[6],[9]], family: 'diatonic', brightness: 0.55 },
  { id: 32, bars: 4, roots: [57, 52, 50, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7]], extensions: [[],[7],[],[9]], family: 'diatonic', brightness: 0.5 },
  
  // More modal and secondary
  { id: 33, bars: 4, roots: [57, 58, 50, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'modal', brightness: 0.65 },
  { id: 34, bars: 4, roots: [57, 60, 52, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7]], family: 'modal', brightness: 0.7 },
  { id: 35, bars: 4, roots: [57, 53, 64, 57], triads: [[0,3,7],[0,4,7],[0,4,7],[0,3,7]], family: 'secondary', brightness: 0.75 },
  { id: 36, bars: 4, roots: [57, 50, 61, 57], triads: [[0,3,7],[0,3,7],[0,4,7],[0,3,7]], family: 'secondary', brightness: 0.7 },
  
  // 8-bar extended
  { id: 37, bars: 8, roots: [57, 53, 52, 57, 50, 53, 55, 57], triads: [[0,3,7],[0,4,7],[0,3,7],[0,3,7],[0,3,7],[0,4,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.45 },
  { id: 38, bars: 8, roots: [57, 50, 52, 50, 53, 52, 55, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7],[0,4,7],[0,3,7],[0,4,7],[0,3,7]], family: 'diatonic', brightness: 0.4 },
  { id: 39, bars: 8, roots: [57, 52, 50, 52, 48, 50, 52, 57], triads: [[0,3,7],[0,3,7],[0,3,7],[0,3,7],[0,4,7],[0,3,7],[0,3,7],[0,3,7]], family: 'diatonic', brightness: 0.35 },
  
  // Additional variations (40-59)
  ...Array.from({ length: 20 }, (_, i): ChordProgression => {
    const baseId = 40 + i;
    const families: Array<'diatonic' | 'modal' | 'secondary' | 'pedal'> = ['diatonic', 'diatonic', 'diatonic', 'modal', 'pedal'];
    const family = families[i % families.length];
    const brightness = 0.3 + (i % 7) * 0.05;
    const roots = [
      [57, 53, 52, 57],
      [57, 50, 52, 57],
      [57, 52, 50, 57],
      [57, 58, 52, 57],
      [57, 57, 52, 57],
      [57, 53, 50, 57],
      [57, 48, 50, 57],
    ][i % 7];
    return {
      id: baseId,
      bars: 4,
      roots,
      triads: roots.map(() => [0, 3, 7] as [number, number, number]),
      family,
      brightness,
    };
  }),
];

/**
 * Bassline patterns library (12 patterns)
 */
const BASSLINE_PATTERNS: BasslinePattern[] = [
  // Offbeat bass
  { id: 0, bars: 1, events: [{ beat: 0, degree: 0, durBeats: 1.5, velocity: 0.75 }, { beat: 1.75, degree: 0, durBeats: 0.5, velocity: 0.65 }, { beat: 2, degree: 0, durBeats: 2, velocity: 0.70 }], style: 'offbeat' },
  { id: 1, bars: 1, events: [{ beat: 0, degree: 0, durBeats: 1, velocity: 0.75 }, { beat: 1.5, degree: 0, durBeats: 0.5, velocity: 0.65 }, { beat: 2.5, degree: 0, durBeats: 1.5, velocity: 0.70 }], style: 'offbeat' },
  
  // Rolling
  { id: 2, bars: 1, events: [{ beat: 0, degree: 0, durBeats: 0.5, velocity: 0.70 }, { beat: 0.5, degree: 4, durBeats: 0.5, velocity: 0.65 }, { beat: 1, degree: 0, durBeats: 0.5, velocity: 0.70 }, { beat: 1.5, degree: 4, durBeats: 0.5, velocity: 0.65 }, { beat: 2, degree: 0, durBeats: 2, velocity: 0.75 }], style: 'rolling' },
  { id: 3, bars: 1, events: [{ beat: 0, degree: 0, durBeats: 0.75, velocity: 0.70 }, { beat: 0.75, degree: 2, durBeats: 0.5, velocity: 0.65 }, { beat: 1.25, degree: 4, durBeats: 0.5, velocity: 0.65 }, { beat: 1.75, degree: 0, durBeats: 2.25, velocity: 0.75 }], style: 'rolling' },
  
  // Syncopated pickup
  { id: 4, bars: 1, events: [{ beat: 0.75, degree: 0, durBeats: 0.5, velocity: 0.65 }, { beat: 1.5, degree: 0, durBeats: 1, velocity: 0.75 }, { beat: 2.5, degree: 0, durBeats: 1.5, velocity: 0.70 }], style: 'syncopated' },
  { id: 5, bars: 1, events: [{ beat: 0.5, degree: 0, durBeats: 0.5, velocity: 0.65 }, { beat: 1, degree: 0, durBeats: 1.5, velocity: 0.75 }, { beat: 2.75, degree: 0, durBeats: 0.5, velocity: 0.65 }, { beat: 3.25, degree: 0, durBeats: 0.75, velocity: 0.70 }], style: 'syncopated' },
  
  // Sustained
  { id: 6, bars: 1, events: [{ beat: 0, degree: 0, durBeats: 4, velocity: 0.70 }], style: 'sustained' },
  { id: 7, bars: 2, events: [{ beat: 0, degree: 0, durBeats: 4, velocity: 0.70 }, { beat: 4, degree: 0, durBeats: 4, velocity: 0.70 }], style: 'sustained' },
  
  // Walking (for non-house genres)
  { id: 8, bars: 1, events: [{ beat: 0, degree: 0, durBeats: 1, velocity: 0.70 }, { beat: 1, degree: 2, durBeats: 1, velocity: 0.65 }, { beat: 2, degree: 4, durBeats: 1, velocity: 0.65 }, { beat: 3, degree: 0, durBeats: 1, velocity: 0.70 }], style: 'walking' },
  { id: 9, bars: 1, events: [{ beat: 0, degree: 0, durBeats: 1, velocity: 0.70 }, { beat: 1, degree: 2, durBeats: 1, velocity: 0.65 }, { beat: 2, degree: 0, durBeats: 2, velocity: 0.70 }], style: 'walking' },
  
  // Pedal
  { id: 10, bars: 1, events: [{ beat: 0, degree: 0, durBeats: 2, velocity: 0.75 }, { beat: 2, degree: 0, durBeats: 2, velocity: 0.70 }], style: 'pedal' },
  { id: 11, bars: 2, events: [{ beat: 0, degree: 0, durBeats: 8, velocity: 0.70 }], style: 'pedal' },
];

/**
 * Expanded hook motifs library (50 motifs)
 */
const HOOK_MOTIFS: HookMotif[] = [
  // Ascending families (1-15)
  { id: 0, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 8 }, { pos16: 8, degree: 2, dur16: 2 }, { pos16: 10, degree: 3, dur16: 2 }, { pos16: 12, degree: 2, dur16: 2 }, { pos16: 14, degree: 0, dur16: 2 }], family: 'ascending', density: 0.5 },
  { id: 1, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 2, dur16: 2 }, { pos16: 6, degree: 3, dur16: 2 }, { pos16: 10, degree: 2, dur16: 2 }, { pos16: 12, degree: 0, dur16: 6 }], family: 'ascending', density: 0.4 },
  { id: 2, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 6 }, { pos16: 6, degree: 1, dur16: 2 }, { pos16: 8, degree: 2, dur16: 2 }, { pos16: 12, degree: 0, dur16: 4 }], family: 'ascending', density: 0.3 },
  { id: 3, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 1, dur16: 2 }, { pos16: 6, degree: 2, dur16: 2 }, { pos16: 8, degree: 3, dur16: 2 }, { pos16: 10, degree: 4, dur16: 2 }, { pos16: 12, degree: 0, dur16: 4 }], family: 'ascending', density: 0.7 },
  { id: 4, bars: 1, notes: [{ pos16: 0, degree: 2, dur16: 6 }, { pos16: 6, degree: 3, dur16: 2 }, { pos16: 8, degree: 5, dur16: 2 }, { pos16: 10, degree: 3, dur16: 2 }, { pos16: 12, degree: 2, dur16: 2 }, { pos16: 14, degree: 0, dur16: 2 }], family: 'ascending', density: 0.6 },
  { id: 5, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 2, degree: 1, dur16: 2 }, { pos16: 4, degree: 2, dur16: 2 }, { pos16: 6, degree: 3, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'ascending', density: 0.5 },
  { id: 6, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 3 }, { pos16: 3, degree: 2, dur16: 3 }, { pos16: 6, degree: 3, dur16: 3 }, { pos16: 9, degree: 4, dur16: 2 }, { pos16: 11, degree: 0, dur16: 5 }], family: 'ascending', density: 0.6 },
  { id: 7, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 2, dur16: 4 }, { pos16: 10, degree: 1, dur16: 2 }, { pos16: 12, degree: 0, dur16: 4 }], family: 'ascending', density: 0.4 },
  { id: 8, bars: 1, notes: [{ pos16: 0, degree: 4, dur16: 4 }, { pos16: 4, degree: 3, dur16: 2 }, { pos16: 8, degree: 2, dur16: 4 }, { pos16: 12, degree: 0, dur16: 4 }], family: 'ascending', density: 0.3 },
  { id: 9, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 2, degree: 2, dur16: 2 }, { pos16: 4, degree: 3, dur16: 2 }, { pos16: 6, degree: 4, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'ascending', density: 0.5 },
  { id: 10, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 5 }, { pos16: 5, degree: 1, dur16: 2 }, { pos16: 7, degree: 2, dur16: 2 }, { pos16: 9, degree: 3, dur16: 2 }, { pos16: 11, degree: 0, dur16: 5 }], family: 'ascending', density: 0.6 },
  { id: 11, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 3 }, { pos16: 3, degree: 2, dur16: 2 }, { pos16: 5, degree: 3, dur16: 2 }, { pos16: 7, degree: 4, dur16: 2 }, { pos16: 9, degree: 0, dur16: 7 }], family: 'ascending', density: 0.5 },
  { id: 12, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 1, dur16: 1 }, { pos16: 5, degree: 2, dur16: 1 }, { pos16: 6, degree: 3, dur16: 1 }, { pos16: 7, degree: 4, dur16: 1 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'ascending', density: 0.7 },
  { id: 13, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 6 }, { pos16: 6, degree: 2, dur16: 2 }, { pos16: 8, degree: 3, dur16: 2 }, { pos16: 10, degree: 4, dur16: 2 }, { pos16: 12, degree: 0, dur16: 4 }], family: 'ascending', density: 0.5 },
  { id: 14, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 2, degree: 1, dur16: 1 }, { pos16: 3, degree: 2, dur16: 1 }, { pos16: 4, degree: 3, dur16: 1 }, { pos16: 5, degree: 4, dur16: 1 }, { pos16: 6, degree: 0, dur16: 10 }], family: 'ascending', density: 0.7 },
  { id: 15, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 7 }, { pos16: 7, degree: 2, dur16: 2 }, { pos16: 9, degree: 3, dur16: 2 }, { pos16: 11, degree: 4, dur16: 2 }, { pos16: 13, degree: 0, dur16: 3 }], family: 'ascending', density: 0.5 },
  
  // Descending families (16-25)
  { id: 16, bars: 1, notes: [{ pos16: 0, degree: 4, dur16: 4 }, { pos16: 4, degree: 3, dur16: 2 }, { pos16: 6, degree: 2, dur16: 2 }, { pos16: 8, degree: 1, dur16: 2 }, { pos16: 10, degree: 0, dur16: 6 }], family: 'descending', density: 0.5 },
  { id: 17, bars: 1, notes: [{ pos16: 0, degree: 5, dur16: 3 }, { pos16: 3, degree: 4, dur16: 2 }, { pos16: 5, degree: 3, dur16: 2 }, { pos16: 7, degree: 2, dur16: 2 }, { pos16: 9, degree: 0, dur16: 7 }], family: 'descending', density: 0.6 },
  { id: 18, bars: 1, notes: [{ pos16: 0, degree: 4, dur16: 2 }, { pos16: 2, degree: 3, dur16: 2 }, { pos16: 4, degree: 2, dur16: 2 }, { pos16: 6, degree: 1, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'descending', density: 0.5 },
  { id: 19, bars: 1, notes: [{ pos16: 0, degree: 5, dur16: 4 }, { pos16: 4, degree: 4, dur16: 2 }, { pos16: 6, degree: 3, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'descending', density: 0.4 },
  { id: 20, bars: 1, notes: [{ pos16: 0, degree: 4, dur16: 1 }, { pos16: 1, degree: 3, dur16: 1 }, { pos16: 2, degree: 2, dur16: 1 }, { pos16: 3, degree: 1, dur16: 1 }, { pos16: 4, degree: 0, dur16: 12 }], family: 'descending', density: 0.7 },
  { id: 21, bars: 1, notes: [{ pos16: 0, degree: 3, dur16: 3 }, { pos16: 3, degree: 2, dur16: 2 }, { pos16: 5, degree: 1, dur16: 2 }, { pos16: 7, degree: 0, dur16: 9 }], family: 'descending', density: 0.5 },
  { id: 22, bars: 1, notes: [{ pos16: 0, degree: 4, dur16: 5 }, { pos16: 5, degree: 3, dur16: 2 }, { pos16: 7, degree: 2, dur16: 2 }, { pos16: 9, degree: 1, dur16: 2 }, { pos16: 11, degree: 0, dur16: 5 }], family: 'descending', density: 0.6 },
  { id: 23, bars: 1, notes: [{ pos16: 0, degree: 5, dur16: 2 }, { pos16: 2, degree: 4, dur16: 2 }, { pos16: 4, degree: 3, dur16: 2 }, { pos16: 6, degree: 2, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'descending', density: 0.5 },
  { id: 24, bars: 1, notes: [{ pos16: 0, degree: 4, dur16: 6 }, { pos16: 6, degree: 3, dur16: 1 }, { pos16: 7, degree: 2, dur16: 1 }, { pos16: 8, degree: 1, dur16: 1 }, { pos16: 9, degree: 0, dur16: 7 }], family: 'descending', density: 0.6 },
  { id: 25, bars: 1, notes: [{ pos16: 0, degree: 3, dur16: 4 }, { pos16: 4, degree: 2, dur16: 2 }, { pos16: 6, degree: 1, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'descending', density: 0.4 },
  
  // Arc families (26-35)
  { id: 26, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 2, dur16: 2 }, { pos16: 6, degree: 4, dur16: 2 }, { pos16: 8, degree: 2, dur16: 2 }, { pos16: 10, degree: 0, dur16: 6 }], family: 'arc', density: 0.5 },
  { id: 27, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 3 }, { pos16: 3, degree: 2, dur16: 2 }, { pos16: 5, degree: 4, dur16: 2 }, { pos16: 7, degree: 3, dur16: 2 }, { pos16: 9, degree: 0, dur16: 7 }], family: 'arc', density: 0.6 },
  { id: 28, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 2, degree: 2, dur16: 1 }, { pos16: 3, degree: 4, dur16: 1 }, { pos16: 4, degree: 3, dur16: 1 }, { pos16: 5, degree: 2, dur16: 1 }, { pos16: 6, degree: 0, dur16: 10 }], family: 'arc', density: 0.7 },
  { id: 29, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 5 }, { pos16: 5, degree: 3, dur16: 2 }, { pos16: 7, degree: 5, dur16: 2 }, { pos16: 9, degree: 3, dur16: 2 }, { pos16: 11, degree: 0, dur16: 5 }], family: 'arc', density: 0.6 },
  { id: 30, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 1, dur16: 1 }, { pos16: 5, degree: 3, dur16: 1 }, { pos16: 6, degree: 4, dur16: 1 }, { pos16: 7, degree: 2, dur16: 1 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'arc', density: 0.7 },
  { id: 31, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 6 }, { pos16: 6, degree: 2, dur16: 2 }, { pos16: 8, degree: 4, dur16: 2 }, { pos16: 10, degree: 2, dur16: 2 }, { pos16: 12, degree: 0, dur16: 4 }], family: 'arc', density: 0.5 },
  { id: 32, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 3 }, { pos16: 3, degree: 3, dur16: 2 }, { pos16: 5, degree: 5, dur16: 2 }, { pos16: 7, degree: 4, dur16: 2 }, { pos16: 9, degree: 0, dur16: 7 }], family: 'arc', density: 0.6 },
  { id: 33, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 2, degree: 2, dur16: 1 }, { pos16: 3, degree: 4, dur16: 1 }, { pos16: 4, degree: 5, dur16: 1 }, { pos16: 5, degree: 3, dur16: 1 }, { pos16: 6, degree: 0, dur16: 10 }], family: 'arc', density: 0.7 },
  { id: 34, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 2, dur16: 2 }, { pos16: 6, degree: 5, dur16: 2 }, { pos16: 8, degree: 3, dur16: 2 }, { pos16: 10, degree: 0, dur16: 6 }], family: 'arc', density: 0.5 },
  { id: 35, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 5 }, { pos16: 5, degree: 2, dur16: 1 }, { pos16: 6, degree: 4, dur16: 1 }, { pos16: 7, degree: 2, dur16: 1 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'arc', density: 0.6 },
  
  // Call-response families (36-42)
  { id: 36, bars: 2, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 2, dur16: 2 }, { pos16: 6, degree: 3, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }, { pos16: 16, degree: 4, dur16: 4 }, { pos16: 20, degree: 3, dur16: 2 }, { pos16: 22, degree: 2, dur16: 2 }, { pos16: 24, degree: 0, dur16: 8 }], family: 'call-response', density: 0.4 },
  { id: 37, bars: 2, notes: [{ pos16: 0, degree: 0, dur16: 6 }, { pos16: 6, degree: 2, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }, { pos16: 16, degree: 3, dur16: 4 }, { pos16: 20, degree: 2, dur16: 2 }, { pos16: 22, degree: 0, dur16: 10 }], family: 'call-response', density: 0.3 },
  { id: 38, bars: 2, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 1, dur16: 2 }, { pos16: 6, degree: 2, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }, { pos16: 16, degree: 4, dur16: 3 }, { pos16: 19, degree: 3, dur16: 2 }, { pos16: 21, degree: 2, dur16: 2 }, { pos16: 23, degree: 0, dur16: 9 }], family: 'call-response', density: 0.5 },
  { id: 39, bars: 2, notes: [{ pos16: 0, degree: 0, dur16: 8 }, { pos16: 8, degree: 2, dur16: 2 }, { pos16: 10, degree: 3, dur16: 2 }, { pos16: 12, degree: 0, dur16: 4 }, { pos16: 16, degree: 4, dur16: 4 }, { pos16: 20, degree: 3, dur16: 2 }, { pos16: 22, degree: 0, dur16: 10 }], family: 'call-response', density: 0.4 },
  { id: 40, bars: 2, notes: [{ pos16: 0, degree: 0, dur16: 3 }, { pos16: 3, degree: 2, dur16: 2 }, { pos16: 5, degree: 3, dur16: 2 }, { pos16: 7, degree: 0, dur16: 9 }, { pos16: 16, degree: 5, dur16: 3 }, { pos16: 19, degree: 4, dur16: 2 }, { pos16: 21, degree: 3, dur16: 2 }, { pos16: 23, degree: 0, dur16: 9 }], family: 'call-response', density: 0.6 },
  { id: 41, bars: 2, notes: [{ pos16: 0, degree: 0, dur16: 6 }, { pos16: 6, degree: 1, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }, { pos16: 16, degree: 3, dur16: 4 }, { pos16: 20, degree: 2, dur16: 2 }, { pos16: 22, degree: 0, dur16: 10 }], family: 'call-response', density: 0.3 },
  { id: 42, bars: 2, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 2, dur16: 4 }, { pos16: 8, degree: 0, dur16: 8 }, { pos16: 16, degree: 4, dur16: 2 }, { pos16: 18, degree: 3, dur16: 2 }, { pos16: 20, degree: 2, dur16: 2 }, { pos16: 22, degree: 0, dur16: 10 }], family: 'call-response', density: 0.5 },
  
  // Repetitive families (43-47)
  { id: 43, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 2, degree: 2, dur16: 2 }, { pos16: 4, degree: 0, dur16: 2 }, { pos16: 6, degree: 2, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'repetitive', density: 0.5 },
  { id: 44, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 3 }, { pos16: 3, degree: 2, dur16: 3 }, { pos16: 6, degree: 0, dur16: 3 }, { pos16: 9, degree: 2, dur16: 3 }, { pos16: 12, degree: 0, dur16: 4 }], family: 'repetitive', density: 0.5 },
  { id: 45, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 3, dur16: 4 }, { pos16: 8, degree: 0, dur16: 4 }, { pos16: 12, degree: 3, dur16: 4 }], family: 'repetitive', density: 0.4 },
  { id: 46, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 2 }, { pos16: 2, degree: 1, dur16: 2 }, { pos16: 4, degree: 0, dur16: 2 }, { pos16: 6, degree: 1, dur16: 2 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'repetitive', density: 0.5 },
  { id: 47, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 1 }, { pos16: 1, degree: 2, dur16: 1 }, { pos16: 2, degree: 0, dur16: 1 }, { pos16: 3, degree: 2, dur16: 1 }, { pos16: 4, degree: 0, dur16: 12 }], family: 'repetitive', density: 0.7 },
  
  // Ornamental families (48-49)
  { id: 48, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 4 }, { pos16: 4, degree: 1, dur16: 1 }, { pos16: 5, degree: 0, dur16: 1 }, { pos16: 6, degree: 2, dur16: 1 }, { pos16: 7, degree: 0, dur16: 1 }, { pos16: 8, degree: 3, dur16: 1 }, { pos16: 9, degree: 0, dur16: 7 }], family: 'ornamental', density: 0.7 },
  { id: 49, bars: 1, notes: [{ pos16: 0, degree: 0, dur16: 3 }, { pos16: 3, degree: 2, dur16: 1 }, { pos16: 4, degree: 1, dur16: 1 }, { pos16: 5, degree: 2, dur16: 1 }, { pos16: 6, degree: 3, dur16: 1 }, { pos16: 7, degree: 2, dur16: 1 }, { pos16: 8, degree: 0, dur16: 8 }], family: 'ornamental', density: 0.8 },
];

/**
 * Select chord progression based on seed + snapshot/features
 */
export function selectChordProgression(
  seed: string,
  elementBlend?: ElementBlend,
  aspectTension?: number,
  moonPhase?: number
): ChordProgression {
  const fire = elementBlend?.fire ?? 0.25;
  const air = elementBlend?.air ?? 0.25;
  const brightness = (fire + air) / 2;
  const tension = aspectTension ?? 0.5;
  
  // Filter by brightness (brighter families for fire/air)
  const candidates = CHORD_PROGRESSIONS.filter(p => {
    const brightnessMatch = brightness > 0.5 ? p.brightness >= 0.4 : p.brightness <= 0.5;
    const tensionMatch = tension > 0.6 ? p.family === 'secondary' || p.family === 'modal' : true;
    return brightnessMatch && tensionMatch;
  });
  
  if (candidates.length === 0) return CHORD_PROGRESSIONS[0];
  
  const idx = randInt(seed, 'progression', candidates.length);
  return candidates[idx];
}

/**
 * Select bassline pattern based on seed + features
 */
export function selectBasslinePattern(
  seed: string,
  genre?: string,
  motionProfile?: MotionProfile
): BasslinePattern {
  const propulsion = motionProfile?.gravity ?? 0.5;
  
  // House prefers offbeat/syncopated; other genres can use walking/sustained
  const housePatterns = BASSLINE_PATTERNS.filter(p => p.style === 'offbeat' || p.style === 'syncopated' || p.style === 'rolling');
  const otherPatterns = BASSLINE_PATTERNS;
  const candidates = genre === 'house' ? housePatterns : otherPatterns;
  
  if (candidates.length === 0) return BASSLINE_PATTERNS[0];
  
  const idx = randInt(seed, 'bassline', candidates.length);
  return candidates[idx];
}

/**
 * Select hook motif based on seed + snapshot/features
 */
export function selectHookMotif(
  seed: string,
  clusterDensity?: number,
  dominantPlanet?: string,
  register?: number
): HookMotif {
  const density = clusterDensity ?? 0.5;
  
  // Filter by density (higher density = more notes)
  const candidates = HOOK_MOTIFS.filter(m => {
    const densityMatch = density > 0.6 ? m.density >= 0.5 : m.density <= 0.6;
    return densityMatch;
  });
  
  if (candidates.length === 0) return HOOK_MOTIFS[0];
  
  const idx = randInt(seed, 'hook', candidates.length);
  return candidates[idx];
}

export { CHORD_PROGRESSIONS, BASSLINE_PATTERNS, HOOK_MOTIFS };
