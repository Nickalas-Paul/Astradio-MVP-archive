// Ambient Empty House Behavior
import { Behavior, HouseContext, EngineDeps } from '../types';
import { colorFromSignRuler } from '../color/SignColor';
import { densityForEmpty, velScaleForEmpty, randomInRange } from '../utils/density';

export const ambient: Behavior = (ctx: HouseContext, d: EngineDeps) => {
  const col = colorFromSignRuler(ctx.cuspSign, ctx.ruler);
  const t0 = ctx.startTime;
  
  // Get instruments
  const padA = d.pool.get("pad_choir");
  const padB = d.pool.get("pad_shimmer");
  const bell = d.pool.get("bell_mallet");
  
  // Schedule layered pads with slow swells
  if (padA) {
    swellPad(d.sched, padA, t0, ctx.duration, ctx.globalKey, {
      rev: col.reverbSend,
      attack: 1.5,
      release: 1.2
    });
  }
  
  if (padB) {
    swellPad(d.sched, padB, t0 + 0.5, ctx.duration, ctx.globalKey, {
      rev: Math.min(1, col.reverbSend + 0.2),
      attack: 2.0
    });
  }
  
  // Optional bell accent
  if (bell && ctx.intensity > 0.2) {
    maybeBellAccent(d.sched, bell, t0 + randomInRange(1, 3, ctx.seed), 0.8, pickColorNote(ctx.globalKey, col));
  }
};

// Schedule pad with slow swell
function swellPad(sched: any, pad: any, startTime: number, duration: number, key: any, opts: { rev: number; attack: number; release?: number }) {
  const chordTones = getChordTones(key, "I");
  const notes = getChordInversion(chordTones, 2); // 2nd inversion for ambient sound
  
  // Schedule pad chord with slow attack and release
  sched.chord(pad, notes, startTime, duration, {
    vel: 0.5,
    attack: opts.attack,
    release: opts.release || 1.0,
    rev: opts.rev,
    granular: 0.3 // Add granular processing
  });
}

// Maybe add bell accent
function maybeBellAccent(sched: any, bell: any, time: number, duration: number, note: string) {
  if (Math.random() < 0.3) { // 30% chance
    sched.note(bell, note, time, duration, {
      vel: 0.4,
      rev: 0.8,
      granular: 0.5
    });
  }
}

// Pick a note from the color chord
function pickColorNote(key: any, col: any): string {
  const chordTones = getChordTones(key, col.chord);
  const randomIndex = Math.floor(Math.random() * chordTones.length);
  return chordTones[randomIndex] + "5"; // High octave for bell
}

// Helper functions (duplicates from other files)
function getChordTones(key: any, chordQuality: string): string[] {
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

function getChordInversion(notes: string[], inversion: number): string[] {
  if (inversion === 0) return notes;
  
  const result = [...notes];
  for (let i = 0; i < inversion; i++) {
    const first = result.shift()!;
    result.push(transposeNote(first, 12));
  }
  
  return result;
}

function transposeNote(note: string, semitones: number): string {
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
