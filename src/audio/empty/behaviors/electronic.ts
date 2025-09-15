// Electronic Empty House Behavior
import { Behavior, HouseContext, EngineDeps } from '../types';
import { colorFromSignRuler } from '../color/SignColor';
import { densityForEmpty, velScaleForEmpty, secondsPerBar, randomInRange } from '../utils/density';

export const electronic: Behavior = (ctx: HouseContext, d: EngineDeps) => {
  const col = colorFromSignRuler(ctx.cuspSign, ctx.ruler);
  const t0 = ctx.startTime;
  
  // Get instruments
  const kit = d.pool.get("tr909");
  const pad = d.pool.get("synth_pad_warm");
  const arp = d.pool.get("pluck_synth");
  
  if (!kit) return;
  
  // Schedule four-on-floor drums
  drumsFourOnFloor(d.sched, kit, t0, ctx.duration, ctx.bpm, { hatDensity: 0.5 });
  
  // Schedule sidechained pad sweep
  if (pad) {
    sweepPad(d.sched, pad, t0, ctx.duration, ctx.globalKey, {
      startCut: col.padCutHz,
      endCut: col.padCutHz * 2,
      sidechain: 0.25
    });
  }
  
  // Schedule gated arpeggio
  if (arp) {
    gatedArp(d.sched, arp, t0 + 0.5, ctx.duration - 0.5, ctx.globalKey, {
      delayMix: 0.2,
      gate: 0.25
    });
  }
};

// Schedule four-on-floor drum pattern
function drumsFourOnFloor(sched: any, kit: any, startTime: number, duration: number, bpm: number, opts: { hatDensity: number }) {
  const bar = secondsPerBar(bpm);
  const quarterNote = bar / 4;
  const eighthNote = bar / 8;
  const sixteenthNote = bar / 16;
  
  // Kick on every quarter note (four-on-floor)
  for (let time = startTime; time < startTime + duration; time += quarterNote) {
    sched.drum(kit, "kick", time, { vel: 0.8 });
  }
  
  // Hi-hats on eighth notes with density control
  for (let time = startTime; time < startTime + duration; time += eighthNote) {
    if (Math.random() < opts.hatDensity) {
      sched.drum(kit, "hihat", time, { vel: 0.6 });
    }
  }
  
  // Snare on 2 and 4
  for (let time = startTime + quarterNote; time < startTime + duration; time += bar) {
    sched.drum(kit, "snare", time, { vel: 0.7 });
    sched.drum(kit, "snare", time + quarterNote, { vel: 0.7 });
  }
  
  // Optional clap on off-beats
  for (let time = startTime + quarterNote * 0.5; time < startTime + duration; time += quarterNote) {
    if (Math.random() < 0.3) {
      sched.drum(kit, "clap", time, { vel: 0.5 });
    }
  }
}

// Schedule pad with filter sweep and sidechain
function sweepPad(sched: any, pad: any, startTime: number, duration: number, key: any, opts: { startCut: number; endCut: number; sidechain: number }) {
  const chordTones = getChordTones(key, "I");
  const notes = getChordInversion(chordTones, 1);
  
  // Schedule pad chord with filter sweep
  sched.chord(pad, notes, startTime, duration, {
    vel: 0.6,
    filterStart: opts.startCut,
    filterEnd: opts.endCut,
    sidechain: opts.sidechain,
    rev: 0.3
  });
}

// Schedule gated arpeggio
function gatedArp(sched: any, arp: any, startTime: number, duration: number, key: any, opts: { delayMix: number; gate: number }) {
  const scale = getScale(key.tonic, key.mode);
  const arpNotes = [scale[0], scale[2], scale[4], scale[1]]; // I chord + 9th
  const sixteenthNote = secondsPerBar(120) / 16;
  
  let noteIndex = 0;
  for (let time = startTime; time < startTime + duration; time += sixteenthNote) {
    // Gate the arpeggio
    if (Math.random() < opts.gate) {
      const note = arpNotes[noteIndex % arpNotes.length];
      sched.note(arp, note, time, sixteenthNote * 0.8, {
        vel: 0.7,
        delayMix: opts.delayMix
      });
    }
    noteIndex++;
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
