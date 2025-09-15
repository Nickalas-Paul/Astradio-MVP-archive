// Master Bus - Handles the master audio processing chain
import * as Tone from 'tone';
import { EQSettings, CompSettings, SaturationCfg } from '../types';

export interface MasterBusConfig {
  convolver?: {
    ir: string;
    wet: number;
  };
  eq?: EQSettings;
  saturation?: SaturationCfg;
  compressor?: CompSettings;
  limiter?: {
    ceiling: number;
    targetLufs: number;
  };
}

export class MasterBus {
  private reverb: Tone.Reverb;
  private eq: Tone.EQ3;
  private compressor: Tone.Compressor;
  private limiter: Tone.Limiter;
  private distortion: Tone.Distortion;
  private isInitialized = false;

  constructor() {
    // Initialize Tone.js effects
    this.reverb = new Tone.Reverb(2).toDestination();
    this.eq = new Tone.EQ3().connect(this.reverb);
    this.compressor = new Tone.Compressor(-20, 3).connect(this.eq);
    this.limiter = new Tone.Limiter(-0.1).connect(this.compressor);
    this.distortion = new Tone.Distortion(0.8).connect(this.limiter);
  }

  async initialize() {
    if (this.isInitialized) return;
    
    // Start Tone.js audio context
    await Tone.start();
    this.isInitialized = true;
  }

  setIR(name: string) {
    // Set reverb impulse response
    switch (name.toLowerCase()) {
      case 'hall':
        this.reverb.decay = 3;
        this.reverb.wet.value = 0.3;
        break;
      case 'room':
        this.reverb.decay = 1.5;
        this.reverb.wet.value = 0.2;
        break;
      case 'plate':
        this.reverb.decay = 2.5;
        this.reverb.wet.value = 0.25;
        break;
      default:
        this.reverb.decay = 2;
        this.reverb.wet.value = 0.2;
    }
  }

  setReverbWet(amount: number) {
    this.reverb.wet.value = Math.max(0, Math.min(1, amount));
  }

  setEQ(low: number, mid: number, high: number) {
    this.eq.low.value = low;
    this.eq.mid.value = mid;
    this.eq.high.value = high;
  }

  setCompressor(threshold: number, ratio: number, attack: number, release: number) {
    this.compressor.threshold.value = threshold;
    this.compressor.ratio.value = ratio;
    this.compressor.attack.value = attack;
    this.compressor.release.value = release;
  }

  setDistortion(amount: number) {
    this.distortion.distortion = Math.max(0, Math.min(1, amount));
  }

  setLimiter(ceiling: number) {
    this.limiter.threshold.value = ceiling;
  }

  // Apply genre-specific settings
  applyGenreSettings(genre: string) {
    switch (genre.toLowerCase()) {
      case 'ambient':
        this.setIR('hall');
        this.setReverbWet(0.35);
        this.setEQ(0, -2, 1);
        this.setCompressor(-20, 1.5, 0.05, 0.3);
        break;
      case 'classical':
        this.setIR('hall');
        this.setReverbWet(0.2);
        this.setEQ(0, 0, 0);
        this.setCompressor(-16, 2.0, 0.02, 0.2);
        break;
      case 'jazz':
        this.setIR('room');
        this.setReverbWet(0.25);
        this.setEQ(1, 0, 1);
        this.setCompressor(-18, 2.5, 0.03, 0.25);
        break;
      case 'electronic':
        this.setIR('plate');
        this.setReverbWet(0.25);
        this.setEQ(2, 0, 2);
        this.setCompressor(-12, 3.0, 0.01, 0.1);
        this.setDistortion(0.1);
        break;
      case 'house':
        this.setIR('room');
        this.setReverbWet(0.3);
        this.setEQ(3, 0, 2);
        this.setCompressor(-14, 2.8, 0.015, 0.15);
        break;
      case 'lofi':
        this.setIR('room');
        this.setReverbWet(0.25);
        this.setEQ(-1, 0, -2);
        this.setCompressor(-22, 1.8, 0.08, 0.4);
        break;
      default:
        this.setIR('room');
        this.setReverbWet(0.2);
        this.setEQ(0, 0, 0);
        this.setCompressor(-20, 2.0, 0.05, 0.2);
    }
  }

  // Get the input node for connecting instruments
  getInput() {
    return this.distortion;
  }

  // Get the output node
  getOutput() {
    return this.reverb;
  }

  // Disconnect and clean up
  dispose() {
    this.reverb.dispose();
    this.eq.dispose();
    this.compressor.dispose();
    this.limiter.dispose();
    this.distortion.dispose();
  }
}
