// Density and Velocity utilities for Empty Houses
import { Genre } from '../types';

// Deterministic RNG for consistent choices
function rng(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Density ranges for empty houses (lower than planetary houses)
const EMPTY_DENSITY_RANGES: Record<Genre, [number, number]> = {
  Classical: [0.2, 0.4],
  Jazz: [0.3, 0.5],
  Electronic: [0.4, 0.6],
  House: [0.5, 0.7],
  "Lo-Fi": [0.2, 0.4],
  Ambient: [0.1, 0.3]
};

// Velocity scaling for empty houses (softer than planetary houses)
const EMPTY_VELOCITY_RANGES: Record<Genre, [number, number]> = {
  Classical: [0.5, 0.75],
  Jazz: [0.6, 0.8],
  Electronic: [0.65, 0.85],
  House: [0.7, 0.9],
  "Lo-Fi": [0.55, 0.75],
  Ambient: [0.4, 0.6]
};

export function densityForEmpty(intensity: number, genre: Genre): number {
  const [min, max] = EMPTY_DENSITY_RANGES[genre];
  return min + (max - min) * intensity;
}

export function velScaleForEmpty(intensity: number, genre: Genre): number {
  const [min, max] = EMPTY_VELOCITY_RANGES[genre];
  return min + (max - min) * intensity;
}

// Helper to get seconds per bar based on BPM
export function secondsPerBar(bpm: number): number {
  return 240 / bpm; // 4/4 time
}

// Helper to get beats per second
export function beatsPerSecond(bpm: number): number {
  return bpm / 60;
}

// Helper to convert beats to seconds
export function beatsToSeconds(beats: number, bpm: number): number {
  return beats / beatsPerSecond(bpm);
}

// Helper to convert seconds to beats
export function secondsToBeats(seconds: number, bpm: number): number {
  return seconds * beatsPerSecond(bpm);
}

// Helper to apply swing to timing
export function applySwing(time: number, swing: number, bpm: number): number {
  const beat = secondsToBeats(time, bpm);
  const beatInBar = beat % 1;
  
  if (beatInBar >= 0.5) {
    return time + (swing * 0.1); // Swing the off-beats
  }
  
  return time;
}

// Helper to get random value within range
export function randomInRange(min: number, max: number, seed: number): number {
  return min + rng(seed) * (max - min);
}

// Helper to get random integer
export function randomInt(min: number, max: number, seed: number): number {
  return Math.floor(randomInRange(min, max + 1, seed));
}

// Helper to choose from array with weighted probability
export function weightedChoice<T>(choices: T[], weights: number[], seed: number): T {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = rng(seed) * totalWeight;
  
  for (let i = 0; i < choices.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return choices[i];
    }
  }
  
  return choices[choices.length - 1];
}

// Helper to check if next house has planets (for builds/transitions)
export function hasPlanetsNext(currentIndex: number, houses: Array<{ number: number; planets: string[] }>): boolean {
  const nextIndex = (currentIndex % 12) + 1;
  const nextHouse = houses.find(h => h.number === nextIndex);
  return nextHouse ? nextHouse.planets.length > 0 : false;
}

// Helper to get chord inversion
export function getChordInversion(notes: string[], inversion: number): string[] {
  if (inversion === 0) return notes;
  
  const result = [...notes];
  for (let i = 0; i < inversion; i++) {
    const first = result.shift()!;
    result.push(transposeNote(first, 12));
  }
  
  return result;
}

// Helper to transpose a note by semitones
export function transposeNote(note: string, semitones: number): string {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteName = note.replace(/\d/g, '');
  const octave = parseInt(note.replace(/\D/g, '')) || 4;
  
  let noteIndex = notes.indexOf(noteName);
  if (noteIndex === -1) return note;
  
  noteIndex = (noteIndex + semitones) % 12;
  if (noteIndex < 0) noteIndex += 12;
  
  const newOctave = octave + Math.floor((notes.indexOf(noteName) + semitones) / 12);
  return notes[noteIndex] + newOctave;
}

// Helper to get degree from key
export function degree(key: { tonic: string; mode: string }, degree: string, octaveOffset: number = 0): string {
  const scale = getScale(key.tonic, key.mode);
  const degreeMap: Record<string, number> = {
    "I": 0, "i": 0,
    "II": 1, "ii": 1,
    "III": 2, "iii": 2,
    "IV": 3, "iv": 3,
    "V": 4, "v": 4,
    "VI": 5, "vi": 5,
    "VII": 6, "vii": 6
  };
  
  const degreeIndex = degreeMap[degree] || 0;
  const note = scale[degreeIndex];
  const octave = 4 + octaveOffset;
  
  return note + octave;
}

// Get scale degrees for a key (duplicate from SignColor.ts for now)
function getScale(tonic: string, mode: string): string[] {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const tonicIndex = notes.indexOf(tonic);
  
  const intervals = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10]
  };
  
  const modeIntervals = intervals[mode as keyof typeof intervals] || intervals.major;
  return modeIntervals.map(interval => notes[(tonicIndex + interval) % 12]);
}
