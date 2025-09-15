// Type definitions for Astradio Audio Overhaul System

export interface AssetManifest {
  version: string;
  lastUpdated: string;
  assets: {
    soundfonts: Record<string, SoundFontAsset>;
    samples: Record<string, Record<string, SampleAsset>>;
    irs: Record<string, IRAsset>;
  };
  loading: {
    core: string[];
    preload: string[];
    lazy: string[];
  };
  licenses: Record<string, string>;
}

export interface SoundFontAsset {
  url: string;
  size: number;
  license: string;
  description: string;
  type: 'sf2' | 'sfz';
}

export interface SampleAsset {
  url: string;
  size: number;
  license: string;
  description: string;
}

export interface IRAsset {
  url: string;
  size: number;
  license: string;
  description: string;
  type: 'convolution';
}

export interface EQSettings {
  lowShelf?: { frequency: number; gain: number };
  highShelf?: { frequency: number; gain: number };
  lowCut?: number;
  highCut?: number;
  tilt?: number; // dB per octave
}

export interface CompSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee?: number;
}

export interface SaturationCfg {
  drive: number; // 0.1-0.5
  type: 'soft' | 'hard' | 'tube';
}

export interface InstrumentSpec {
  type: 'soundfont' | 'sample' | 'synth';
  source: string; // asset path or synth config
  maxPolyphony?: number;
  envelope?: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  filter?: {
    frequency: number;
    type: 'lowpass' | 'highpass' | 'bandpass';
    q?: number;
  };
  effects?: string[]; // effect chain names
}

export interface DrumKitSpec {
  kick: string;
  snare: string;
  hat: string;
  additional?: Record<string, string>;
}

export interface GrooveSpec {
  name: string;
  pattern: string; // "x---x---x---x---" format
  swing: number; // 0-0.6
  velocity: number[]; // per hit velocity
  ghostNotes?: number[]; // positions for ghost notes
}

export interface GenrePreset {
  name: string;
  bpm: number;
  swing: number; // 0..0.6
  bus: {
    ir: string;
    wet?: number; // Reverb wet level (0-1)
    eq?: EQSettings;
    compressor?: CompSettings;
    preEQ?: EQSettings;
    postComp?: CompSettings;
    saturation?: SaturationCfg;
  };
  instruments: Record<string, InstrumentSpec>;
  drumKit?: DrumKitSpec;
  grooves?: GrooveSpec[];
}

export interface PlanetMotif {
  planet: string;
  role: string;
  intervals: number[]; // semitones from tonic
  rhythm: {
    density: number; // 0-1
    syncopation: number; // 0-1
    accentPattern: number[]; // velocity multipliers
  };
  timbre: {
    filterFreq: number;
    resonance: number;
    envelope: 'short' | 'medium' | 'long';
  };
  defaultRole: string;
}

export interface AspectConfig {
  type: 'trine' | 'sextile' | 'square' | 'opposition' | 'conjunction';
  planets: string[];
  tension: number; // 0-1
  resolution: number; // 0-1
}

export interface ChartData {
  positions: Record<string, number>; // planet name -> degree
  cusps: number[]; // 12 house cusps
  houses?: HouseData[];
  planets?: Record<string, PlanetData>;
}

export interface HouseData {
  number: number;
  planets: string[];
  sign: number;
  cusp: number;
}

export interface PlanetData {
  name: string;
  degree: number;
  sign: number;
  house: number;
  aspects: AspectData[];
}

export interface AspectData {
  type: string;
  target: string;
  angle: number;
  orb: number;
}

export interface CompositionMode {
  name: string;
  description: string;
  default: boolean;
}

export interface CompositionSection {
  type: string;
  bars: number;
  startTime: number;
  duration: number;
  key: KeySignature;
  bpm: number;
  swing: number;
  composition?: SectionComposition;
}

export interface SectionComposition {
  chords: ChordProgression[];
  bass: BassLine[];
  lead: MelodyLine[];
  groove: GroovePattern;
  pad?: PadLayer[];
}

export interface ChordProgression {
  time: number;
  duration: number;
  chord: string;
  voicing: number[];
  velocity: number;
}

export interface BassLine {
  time: number;
  duration: number;
  note: string;
  octave: number;
  velocity: number;
}

export interface MelodyLine {
  time: number;
  duration: number;
  note: string;
  octave: number;
  velocity: number;
  articulation?: string;
}

export interface GroovePattern {
  kick: string;
  snare: string;
  hat: string;
  additional?: Record<string, string>;
}

export interface PadLayer {
  time: number;
  duration: number;
  chord: string;
  voicing: number[];
  velocity: number;
  type: string;
}

export interface HumanizeSettings {
  timingJitter: number; // ±ms
  velocityCurve: 'linear' | 'exponential' | 'logarithmic';
  velocityRange: [number, number]; // min, max
  detuneRange: number; // ±cents
  roundRobin: boolean;
}

export interface SchedulerSettings {
  bpm: number;
  swing: number;
  lookahead: number; // seconds
  driftCorrection: boolean;
  quantization: 'none' | '8n' | '16n' | '32n';
}

export interface MasterBusSettings {
  convolver: {
    ir: string;
    wet: number;
  };
  eq: EQSettings;
  saturation: SaturationCfg;
  compressor: CompSettings;
  limiter: {
    ceiling: number;
    targetLufs: number;
  };
}

export interface RenderOptions {
  durationSec: number;
  sampleRate?: number;
  bitDepth?: number;
  format?: 'wav' | 'mp3';
}

export interface LoadOptions {
  manifestUrl: string;
  cacheStrategy?: 'memory' | 'indexeddb' | 'cachestorage';
  preloadCore?: boolean;
  maxConcurrent?: number;
}

export interface SoundEngineConfig {
  loadOptions: LoadOptions;
  humanize: HumanizeSettings;
  scheduler: SchedulerSettings;
  masterBus: MasterBusSettings;
}

// Event types for the audio system
export interface AudioEvent {
  type: 'load' | 'play' | 'stop' | 'error' | 'progress';
  data?: any;
  timestamp: number;
}

export interface LoadProgress {
  loaded: number;
  total: number;
  current: string;
  percentage: number;
}

// Utility types
export type Note = string; // e.g., "C4", "F#3"
export type Chord = Note[];
export type Progression = Chord[];

export interface KeySignature {
  tonic: string;
  mode: 'major' | 'minor' | 'dorian' | 'mixolydian' | 'lydian' | 'phrygian' | 'locrian';
}

export interface Voice {
  note: Note;
  velocity: number;
  startTime: number;
  duration: number;
  channel: number;
}

export interface Pattern {
  voices: Voice[];
  length: number; // in beats
  loop: boolean;
}

// Error types
export class AudioLoadError extends Error {
  constructor(message: string, public asset: string, public originalError?: Error) {
    super(message);
    this.name = 'AudioLoadError';
  }
}

export class AudioPlaybackError extends Error {
  constructor(message: string, public context: string) {
    super(message);
    this.name = 'AudioPlaybackError';
  }
}
