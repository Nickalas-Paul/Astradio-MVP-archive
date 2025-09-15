// Lo-Fi Empty House Behavior
import { Behavior, HouseContext, EngineDeps } from '../types';
import { colorFromSignRuler } from '../color/SignColor';
import { densityForEmpty, velScaleForEmpty, secondsPerBar, randomInRange } from '../utils/density';

export const lofi: Behavior = (ctx: HouseContext, d: EngineDeps) => {
  const col = colorFromSignRuler(ctx.cuspSign, ctx.ruler);
  const t0 = ctx.startTime;
  
  // Get instruments
  const vinyl = d.pool.get("vinyl_noise");
  const kit = d.pool.get("lofi_kit");
  const rhodes = d.pool.get("rhodes");
  
  // Schedule vinyl bed
  if (vinyl) {
    loFiBed(d.sched, vinyl, t0, ctx.duration, { mix: 0.15 });
  }
  
  // Schedule lazy drums
  if (kit) {
    lazyDrums(d.sched, kit, t0, ctx.duration, ctx.bpm, { swing: ctx.swing });
  }
  
  // Schedule Rhodes chords
  if (rhodes) {
    rhodesChords(d.sched, rhodes, t0 + 0.2, ctx.duration - 0.2, ctx.globalKey, spread(col.chord), {
      lpHz: 8000,
      detuneCents: 5
    });
  }
};

// Schedule lo-fi vinyl bed
function loFiBed(sched: any, vinyl: any, startTime: number, duration: number, opts: { mix: number }) {
  // Schedule vinyl noise with low mix
  sched.sample(vinyl, startTime, duration, {
    mix: opts.mix,
    lpHz: 4000, // Low-pass to make it subtle
    rev: 0.2
  });
}

// Schedule lazy drum pattern
function lazyDrums(sched: any, kit: any, startTime: number, duration: number, bpm: number, opts: { swing: number }) {
  const bar = secondsPerBar(bpm);
  const quarterNote = bar / 4;
  const eighthNote = bar / 8;
  
  // Kick on 1 and 3 (but sometimes lazy)
  for (let time = startTime; time < startTime + duration; time += bar) {
    if (Math.random() > 0.1) { // 90% chance to hit
      sched.drum(kit, "kick", time, { vel: 0.7 });
    }
    if (Math.random() > 0.2) { // 80% chance to hit
      sched.drum(kit, "kick", time + quarterNote * 2, { vel: 0.6 });
    }
  }
  
  // Snare on 2 and 4 (but sometimes lazy)
  for (let time = startTime + quarterNote; time < startTime + duration; time += bar) {
    if (Math.random() > 0.15) { // 85% chance to hit
      sched.drum(kit, "snare", time, { vel: 0.6 });
    }
    if (Math.random() > 0.25) { // 75% chance to hit
      sched.drum(kit, "snare", time + quarterNote, { vel: 0.5 });
    }
  }
  
  // Hi-hats on eighth notes (but lazy)
  for (let time = startTime; time < startTime + duration; time += eighthNote) {
    if (Math.random() > 0.3) { // 70% chance to hit
      const swungTime = applySwing(time, opts.swing, bpm);
      sched.drum(kit, "hihat", swungTime, { vel: 0.4 });
    }
  }
  
  // Rim shots occasionally
  for (let time = startTime + eighthNote * 2; time < startTime + duration; time += bar) {
    if (Math.random() < 0.3) {
      sched.drum(kit, "rim", time, { vel: 0.3 });
    }
  }
}

// Schedule Rhodes chords with spread voicing
function rhodesChords(sched: any, rhodes: any, startTime: number, duration: number, key: any, chordQuality: string, opts: { lpHz: number; detuneCents: number }) {
  const chordTones = getChordTones(key, chordQuality);
  const spreadVoicing = spreadChord(chordTones);
  const bar = secondsPerBar(85); // Lo-fi tempo
  const halfNote = bar / 2;
  
  // Schedule spread chord voicing
  sched.chord(rhodes, spreadVoicing, startTime, duration, {
    vel: 0.6,
    lpHz: opts.lpHz,
    detune: opts.detuneCents,
    rev: 0.3
  });
  
  // Optional arpeggiated notes
  if (duration > 2) {
    const eighthNote = bar / 8;
    for (let time = startTime + halfNote; time < startTime + duration - 0.5; time += eighthNote) {
      if (Math.random() < 0.2) {
        const note = spreadVoicing[Math.floor(Math.random() * spreadVoicing.length)];
        sched.note(rhodes, note, time, eighthNote * 0.7, {
          vel: 0.4,
          detune: opts.detuneCents
        });
      }
    }
  }
}

// Spread chord voicing for lo-fi sound
function spread(chordQuality: string): string {
  // Map chord qualities to spread voicings
  switch (chordQuality) {
    case "add6":
      return "add6";
    case "sus2":
      return "sus2";
    case "sus4":
      return "sus4";
    default:
      return chordQuality;
  }
}

// Create spread chord voicing
function spreadChord(notes: string[]): string[] {
  if (notes.length < 3) return notes;
  
  const result = [...notes];
  
  // Spread the voicing by moving some notes up an octave
  if (result.length >= 3) {
    result[1] = transposeNote(result[1], 12); // Move third up
  }
  if (result.length >= 4) {
    result[3] = transposeNote(result[3], 12); // Move fourth note up
  }
  
  return result;
}

// Apply swing to timing
function applySwing(time: number, swing: number, bpm: number): number {
  const bar = secondsPerBar(bpm);
  const beat = (time % bar) / bar;
  
  if (beat >= 0.5) {
    return time + (swing * 0.1); // Swing the off-beats
  }
  
  return time;
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
