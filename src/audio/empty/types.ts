// Type definitions for Empty House Logic System

export type Genre = "Classical" | "Jazz" | "Electronic" | "House" | "Lo-Fi" | "Ambient";

export type PlanetName = "Sun" | "Moon" | "Mercury" | "Venus" | "Mars" | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto";

export interface HouseContext {
  index: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  empty: boolean;                 // true => no planets in house segment
  cuspSign: number;               // 0..11 (Aries..Pisces)
  ruler: PlanetName;              // sign ruler
  startTime: number;              // seconds in arrangement
  duration: number;               // normally 5
  globalKey: { tonic: string; mode: "major" | "minor" | "dorian" | "aeolian" | "mixolydian" | "lydian" | "phrygian" | "locrian" };
  bpm: number;
  swing: number;                  // 0..0.6
  intensity: number;              // 0..1 (from aspects/stellium elsewhere)
  seed: number;
}

export interface EngineDeps {
  pool: any;                      // InstrumentPool - get("upright_bass"), get("pad_choir"), etc.
  bus: any;                       // MasterBus - for sending FX sends (reverb/delay)
  sched: any;                     // Scheduler - schedule(note|sample, time, opts)
}

export type Behavior = (ctx: HouseContext, d: EngineDeps) => void;

export interface SignColor {
  chord: "I" | "ii" | "iii" | "IV" | "V" | "vi" | "bVII" | "sus2" | "sus4" | "add6" | "min7" | "dim";
  padCutHz: number;               // high-pass cutoff
  brightness: number;             // 0..1 -> filter open amount
  reverbSend: number;             // 0..1
  ornaments: "none" | "mordent" | "turn" | "grace";
}

// Utility types for scheduling
export interface NoteEvent {
  note: string;
  velocity: number;
  startTime: number;
  duration: number;
  channel?: number;
}

export interface ChordEvent {
  notes: string[];
  velocity: number;
  startTime: number;
  duration: number;
  channel?: number;
}

export interface DrumEvent {
  drum: string;
  velocity: number;
  time: number;
  channel?: number;
}
