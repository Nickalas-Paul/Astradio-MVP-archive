// Classical Empty House Behavior
import { Behavior, HouseContext, EngineDeps } from '../types';
import { colorFromSignRuler, getChordTones } from '../color/SignColor';
import { velScaleForEmpty, getChordInversion, degree } from '../utils/density';

export const classical: Behavior = (ctx: HouseContext, d: EngineDeps) => {
  const col = colorFromSignRuler(ctx.cuspSign, ctx.ruler);
  const vel = velScaleForEmpty(ctx.intensity, "Classical");
  const t0 = ctx.startTime;
  
  // Get strings ensemble for sustained pad
  const pad = d.pool.get("strings_ensemble");
  if (!pad) return;
  
  // Get chord tones from global key and sign color
  const chordTones = getChordTones(ctx.globalKey, col.chord);
  const notes = getChordInversion(chordTones, 2); // Use 2nd inversion for classical sound
  
  // Schedule sustained strings chord
  d.sched.chord(pad, notes, t0, ctx.duration * 0.9, {
    vel,
    hpHz: col.padCutHz,
    rev: col.reverbSend
  });
  
  // Optional timpani roll for cadence every 3rd empty house
  if (ctx.index % 3 === 0) {
    const timp = d.pool.get("timpani");
    if (timp) {
      const cadenceNote = degree(ctx.globalKey, "V", -12); // Dominant in bass octave
      d.sched.note(timp, cadenceNote, t0 + ctx.duration * 0.75, ctx.duration * 0.25, {
        vel: 0.55
      });
    }
  }
  
  // Optional grace note ornamentation based on sign color
  if (col.ornaments === "grace" && ctx.intensity > 0.3) {
    const violin = d.pool.get("violin_solo");
    if (violin) {
      const graceNote = notes[0]; // Use root of chord
      const mainNote = transposeNote(graceNote, 2); // Major second up
      
      // Grace note
      d.sched.note(violin, graceNote, t0 + 0.1, 0.05, { vel: vel * 0.7 });
      // Main note
      d.sched.note(violin, mainNote, t0 + 0.15, ctx.duration * 0.3, { vel: vel * 0.8 });
    }
  }
  
  // Voice leading: end on V→I mini-cadence every 2 empty houses
  if (ctx.index % 2 === 0 && ctx.duration > 3) {
    const cello = d.pool.get("cello");
    if (cello) {
      const vNote = degree(ctx.globalKey, "V", -12);
      const iNote = degree(ctx.globalKey, "I", -12);
      
      // V chord
      d.sched.note(cello, vNote, t0 + ctx.duration * 0.6, ctx.duration * 0.2, { vel: vel * 0.6 });
      // I chord resolution
      d.sched.note(cello, iNote, t0 + ctx.duration * 0.8, ctx.duration * 0.2, { vel: vel * 0.7 });
    }
  }
};

// Helper function to transpose a note (duplicate from density.ts for now)
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
