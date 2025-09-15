// Jazz Empty House Behavior
import { Behavior, HouseContext, EngineDeps } from '../types';
import { colorFromSignRuler } from '../color/SignColor';
import { densityForEmpty, velScaleForEmpty, secondsPerBar, applySwing, randomInRange } from '../utils/density';

export const jazz: Behavior = (ctx: HouseContext, d: EngineDeps) => {
  const col = colorFromSignRuler(ctx.cuspSign, ctx.ruler);
  const dens = densityForEmpty(ctx.intensity, "Jazz");
  const t0 = ctx.startTime;
  const bar = secondsPerBar(ctx.bpm);
  
  // Get instruments
  const bass = d.pool.get("upright_bass");
  const kit = d.pool.get("jazz_kit");
  const piano = d.pool.get("jazz_piano");
  
  if (!bass || !kit) return;
  
  // Schedule ride pattern
  scheduleRidePattern(d.sched, kit, t0, ctx.duration, ctx.swing, { vel: 0.6 });
  
  // Schedule brush backbeat
  scheduleBrushBackbeat(d.sched, kit, t0, ctx.duration, { amount: dens });
  
  // Schedule walking bass
  scheduleWalkingBass(d.sched, bass, t0, ctx.duration, ctx.globalKey, chooseTurnaround(col));
  
  // Optional sparse piano comping
  if (piano && ctx.intensity > 0.2) {
    maybeSparsePianoComp(d.sched, piano, t0, ctx.duration, ctx.globalKey, { density: dens * 0.6 });
  }
};

// Schedule ride cymbal pattern
function scheduleRidePattern(sched: any, kit: any, startTime: number, duration: number, swing: number, opts: { vel: number }) {
  const bar = 240 / 120; // Assuming 120 BPM for now
  const eighthNote = bar / 8;
  
  for (let time = startTime; time < startTime + duration; time += eighthNote) {
    const swungTime = applySwing(time, swing, 120);
    sched.drum(kit, "ride", swungTime, { vel: opts.vel });
  }
}

// Schedule brush snare backbeat
function scheduleBrushBackbeat(sched: any, kit: any, startTime: number, duration: number, opts: { amount: number }) {
  const bar = 240 / 120;
  const quarterNote = bar / 4;
  
  for (let time = startTime + quarterNote; time < startTime + duration; time += bar) {
    if (Math.random() < opts.amount) {
      sched.drum(kit, "brush_snare", time, { vel: 0.4 });
    }
  }
}

// Schedule walking bass line
function scheduleWalkingBass(sched: any, bass: any, startTime: number, duration: number, key: any, turnaround: string[]) {
  const bar = 240 / 120;
  const quarterNote = bar / 4;
  const scale = getScale(key.tonic, key.mode);
  
  let currentChord = 0;
  const chords = turnaround.length > 0 ? turnaround : ["I", "vi", "ii", "V"];
  
  for (let time = startTime; time < startTime + duration; time += quarterNote) {
    const chordRoot = degree(key, chords[currentChord % chords.length], -12);
    const bassNote = getWalkingBassNote(chordRoot, scale, time - startTime);
    
    sched.note(bass, bassNote, time, quarterNote * 0.9, { vel: 0.7 });
    
    if ((time - startTime) % bar === 0) {
      currentChord++;
    }
  }
}

// Get walking bass note with chromatic approach tones
function getWalkingBassNote(chordRoot: string, scale: string[], timeInBar: number): string {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const rootNote = chordRoot.replace(/\d/g, '');
  const octave = parseInt(chordRoot.replace(/\D/g, '')) || 2;
  
  const rootIndex = notes.indexOf(rootNote);
  const beatInBar = Math.floor((timeInBar % 1) * 4);
  
  // Walking bass pattern: root, scale tone, chromatic approach, target
  const pattern = [0, 2, -1, 0]; // Root, third, chromatic approach, root
  const interval = pattern[beatInBar % 4];
  
  let noteIndex = (rootIndex + interval) % 12;
  if (noteIndex < 0) noteIndex += 12;
  
  return notes[noteIndex] + octave;
}

// Choose turnaround based on sign color
function chooseTurnaround(col: any): string[] {
  switch (col.chord) {
    case "ii":
      return ["ii", "V", "I"];
    case "V":
      return ["V", "I"];
    case "add6":
      return ["I", "vi", "ii", "V"];
    default:
      return ["I", "vi", "ii", "V"];
  }
}

// Maybe add sparse piano comping
function maybeSparsePianoComp(sched: any, piano: any, startTime: number, duration: number, key: any, opts: { density: number }) {
  const bar = 240 / 120;
  const halfNote = bar / 2;
  
  for (let time = startTime; time < startTime + duration; time += halfNote) {
    if (Math.random() < opts.density) {
      const chordTones = getChordTones(key, "I");
      const voicing = getChordInversion(chordTones, 1); // 1st inversion
      
      sched.chord(piano, voicing, time, halfNote * 0.8, { vel: 0.5 });
    }
  }
}

// Helper functions (duplicates from other files)
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

function degree(key: any, degree: string, octaveOffset: number = 0): string {
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
