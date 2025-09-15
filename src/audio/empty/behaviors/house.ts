// House Empty House Behavior
import { Behavior, HouseContext, EngineDeps } from '../types';
import { colorFromSignRuler, getChordTones } from '../color/SignColor';
import { densityForEmpty, velScaleForEmpty, secondsPerBar, hasPlanetsNext } from '../utils/density';

export const house: Behavior = (ctx: HouseContext, d: EngineDeps) => {
  const col = colorFromSignRuler(ctx.cuspSign, ctx.ruler);
  const t0 = ctx.startTime;
  
  // Get instruments
  const kit = d.pool.get("house_kit");
  const bass = d.pool.get("house_bass");
  const noise = d.pool.get("noise_fx");
  
  if (!kit) return;
  
  // Schedule house groove
  grooveHouse(d.sched, kit, t0, ctx.duration, ctx.bpm, { ghosts: 0.3 });
  
  // Schedule bass ostinato
  if (bass) {
    bassOstinato(d.sched, bass, t0, ctx.duration, ctx.globalKey, { vel: 0.7 });
  }
  
  // Schedule riser noise
  if (noise) {
    riserNoise(d.sched, noise, t0, ctx.duration, { from: 2000, to: 10000 });
  }
  
  // Snare roll build if next house has planets
  if (hasPlanetsNext(ctx.index, [])) { // TODO: Pass actual houses array
    snareRoll(d.sched, kit, t0 + ctx.duration - 1.0, 1.0, { rate: "32→64" });
  }
};

// Schedule house groove pattern
function grooveHouse(sched: any, kit: any, startTime: number, duration: number, bpm: number, opts: { ghosts: number }) {
  const bar = secondsPerBar(bpm);
  const quarterNote = bar / 4;
  const eighthNote = bar / 8;
  const sixteenthNote = bar / 16;
  
  // Kick on 1 and 3
  for (let time = startTime; time < startTime + duration; time += bar) {
    sched.drum(kit, "kick", time, { vel: 0.9 });
    sched.drum(kit, "kick", time + quarterNote * 2, { vel: 0.9 });
  }
  
  // Snare on 2 and 4
  for (let time = startTime + quarterNote; time < startTime + duration; time += bar) {
    sched.drum(kit, "snare", time, { vel: 0.8 });
    sched.drum(kit, "snare", time + quarterNote, { vel: 0.8 });
  }
  
  // Hi-hats on eighth notes
  for (let time = startTime; time < startTime + duration; time += eighthNote) {
    sched.drum(kit, "hihat", time, { vel: 0.6 });
  }
  
  // Ghost snares
  for (let time = startTime + eighthNote * 3; time < startTime + duration; time += bar) {
    if (Math.random() < opts.ghosts) {
      sched.drum(kit, "snare", time, { vel: 0.3 });
    }
  }
  
  // Clap on off-beats
  for (let time = startTime + quarterNote * 0.5; time < startTime + duration; time += quarterNote) {
    if (Math.random() < 0.4) {
      sched.drum(kit, "clap", time, { vel: 0.5 });
    }
  }
}

// Schedule bass ostinato
function bassOstinato(sched: any, bass: any, startTime: number, duration: number, key: any, opts: { vel: number }) {
  const scale = getScale(key.tonic, key.mode);
  const rootNote = scale[0] + "2"; // Bass octave
  const fifthNote = scale[4] + "2";
  const bar = secondsPerBar(128); // House tempo
  const eighthNote = bar / 8;
  
  const pattern = [rootNote, rootNote, fifthNote, rootNote];
  let patternIndex = 0;
  
  for (let time = startTime; time < startTime + duration; time += eighthNote) {
    const note = pattern[patternIndex % pattern.length];
    sched.note(bass, note, time, eighthNote * 0.8, { vel: opts.vel });
    patternIndex++;
  }
}

// Schedule riser noise
function riserNoise(sched: any, noise: any, startTime: number, duration: number, opts: { from: number; to: number }) {
  // Schedule noise sweep from low to high frequency
  sched.sample(noise, startTime, duration, {
    filterStart: opts.from,
    filterEnd: opts.to,
    rev: 0.4,
    sidechain: 0.3
  });
}

// Schedule snare roll build
function snareRoll(sched: any, kit: any, startTime: number, duration: number, opts: { rate: string }) {
  const bar = secondsPerBar(128);
  const sixteenthNote = bar / 16;
  const thirtySecondNote = bar / 32;
  
  // Start with sixteenth notes, accelerate to thirty-second notes
  const totalBeats = duration / bar;
  const accelerationPoint = totalBeats * 0.6;
  
  let currentTime = startTime;
  let noteDuration = sixteenthNote;
  
  while (currentTime < startTime + duration) {
    sched.drum(kit, "snare", currentTime, { vel: 0.6 });
    
    // Accelerate note duration
    const beatPosition = (currentTime - startTime) / bar;
    if (beatPosition > accelerationPoint) {
      noteDuration = thirtySecondNote;
    }
    
    currentTime += noteDuration;
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
