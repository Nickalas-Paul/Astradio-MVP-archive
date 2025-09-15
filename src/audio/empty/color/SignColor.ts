// Sign and Ruler to Musical Color Mapping
import { SignColor, PlanetName } from '../types';

// Deterministic RNG for consistent choices
function rng(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Map signs to their rulers
const SIGN_RULERS: Record<number, PlanetName> = {
  0: "Mars",    // Aries
  1: "Venus",   // Taurus
  2: "Mercury", // Gemini
  3: "Moon",    // Cancer
  4: "Sun",     // Leo
  5: "Mercury", // Virgo
  6: "Venus",   // Libra
  7: "Mars",    // Scorpio
  8: "Jupiter", // Sagittarius
  9: "Saturn",  // Capricorn
  10: "Saturn", // Aquarius
  11: "Jupiter" // Pisces
};

// Ruler characteristics mapping
const RULER_COLORS: Record<PlanetName, Partial<SignColor>> = {
  Sun: {
    chord: "I",
    padCutHz: 200,
    brightness: 0.8,
    reverbSend: 0.3,
    ornaments: "grace"
  },
  Moon: {
    chord: "vi",
    padCutHz: 150,
    brightness: 0.6,
    reverbSend: 0.5,
    ornaments: "mordent"
  },
  Mercury: {
    chord: "ii",
    padCutHz: 300,
    brightness: 0.7,
    reverbSend: 0.2,
    ornaments: "turn"
  },
  Venus: {
    chord: "add6",
    padCutHz: 180,
    brightness: 0.9,
    reverbSend: 0.4,
    ornaments: "grace"
  },
  Mars: {
    chord: "V",
    padCutHz: 400,
    brightness: 0.6,
    reverbSend: 0.1,
    ornaments: "none"
  },
  Jupiter: {
    chord: "IV",
    padCutHz: 250,
    brightness: 0.8,
    reverbSend: 0.3,
    ornaments: "turn"
  },
  Saturn: {
    chord: "bVII",
    padCutHz: 350,
    brightness: 0.5,
    reverbSend: 0.6,
    ornaments: "none"
  },
  Uranus: {
    chord: "sus4",
    padCutHz: 500,
    brightness: 0.9,
    reverbSend: 0.2,
    ornaments: "turn"
  },
  Neptune: {
    chord: "sus2",
    padCutHz: 120,
    brightness: 0.4,
    reverbSend: 0.8,
    ornaments: "mordent"
  },
  Pluto: {
    chord: "dim",
    padCutHz: 600,
    brightness: 0.3,
    reverbSend: 0.7,
    ornaments: "none"
  }
};

// Sign-specific modifiers
const SIGN_MODIFIERS: Record<number, Partial<SignColor>> = {
  0: { brightness: 0.7, padCutHz: 450 },  // Aries - more aggressive
  1: { reverbSend: 0.6, brightness: 0.8 }, // Taurus - warmer
  2: { padCutHz: 350, ornaments: "turn" }, // Gemini - more movement
  3: { reverbSend: 0.7, brightness: 0.5 }, // Cancer - more ambient
  4: { brightness: 0.9, reverbSend: 0.2 }, // Leo - brighter
  5: { padCutHz: 400, brightness: 0.6 },   // Virgo - more precise
  6: { reverbSend: 0.5, brightness: 0.8 }, // Libra - balanced
  7: { padCutHz: 550, brightness: 0.4 },   // Scorpio - darker
  8: { brightness: 0.8, reverbSend: 0.3 }, // Sagittarius - expansive
  9: { padCutHz: 300, brightness: 0.5 },   // Capricorn - grounded
  10: { brightness: 0.9, padCutHz: 650 },  // Aquarius - experimental
  11: { reverbSend: 0.9, brightness: 0.3 } // Pisces - dreamy
};

export function colorFromSignRuler(sign: number, ruler: PlanetName): SignColor {
  const baseColor = RULER_COLORS[ruler];
  const signMod = SIGN_MODIFIERS[sign] || {};
  
  // Merge base ruler characteristics with sign modifiers
  const merged: SignColor = {
    chord: signMod.chord || baseColor.chord || "I",
    padCutHz: signMod.padCutHz || baseColor.padCutHz || 250,
    brightness: signMod.brightness || baseColor.brightness || 0.7,
    reverbSend: signMod.reverbSend || baseColor.reverbSend || 0.3,
    ornaments: signMod.ornaments || baseColor.ornaments || "none"
  };
  
  return merged;
}

// Helper to get ruler from sign
export function getRulerFromSign(sign: number): PlanetName {
  return SIGN_RULERS[sign] || "Sun";
}

// Helper to get chord tones from key and chord quality
export function getChordTones(key: { tonic: string; mode: string }, chordQuality: string): string[] {
  const scale = getScale(key.tonic, key.mode);
  
  switch (chordQuality) {
    case "I":
      return [scale[0], scale[2], scale[4]];
    case "ii":
      return [scale[1], scale[3], scale[5]];
    case "iii":
      return [scale[2], scale[4], scale[6]];
    case "IV":
      return [scale[3], scale[5], scale[0]];
    case "V":
      return [scale[4], scale[6], scale[1]];
    case "vi":
      return [scale[5], scale[0], scale[2]];
    case "bVII":
      return [scale[6], scale[1], scale[3]];
    case "sus2":
      return [scale[0], scale[1], scale[4]];
    case "sus4":
      return [scale[0], scale[3], scale[4]];
    case "add6":
      return [scale[0], scale[2], scale[4], scale[5]];
    case "min7":
      return [scale[0], scale[2], scale[4], scale[6]];
    case "dim":
      return [scale[0], scale[2], scale[5]];
    default:
      return [scale[0], scale[2], scale[4]];
  }
}

// Get scale degrees for a key
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
