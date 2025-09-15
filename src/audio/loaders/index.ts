import { SampleLoader, type LoadedSample, type SampleConfig } from './SampleLoader';
import { SoundFontLoader, type LoadedInstrument, type SoundFontConfig } from './SoundFontLoader';
import { SFZLoader, type LoadedSFZ, type SFZConfig } from './SFZLoader';
import * as Tone from 'tone';

export interface AssetManifest {
  version: number;
  instruments: Record<string, {
    type: 'sf2' | 'sfz' | 'sample' | 'kit' | 'loop';
    url?: string;
    voices?: number;
    root?: string;
  }>;
  irs: Record<string, string>;
  licenses: Array<{
    name: string;
    url: string;
    license: string;
  }>;
}

export interface LoadedAssets {
  instruments: Map<string, LoadedInstrument | LoadedSFZ>;
  samples: Map<string, LoadedSample>;
  effects: Map<string, Tone.Convolver>;
}

export class AssetManager {
  private sampleLoader: SampleLoader;
  private soundFontLoader: SoundFontLoader;
  private sfzLoader: SFZLoader;
  private loadedAssets: LoadedAssets;
  private manifest: AssetManifest | null = null;

  constructor() {
    this.sampleLoader = new SampleLoader();
    this.soundFontLoader = new SoundFontLoader();
    this.sfzLoader = new SFZLoader();
    this.loadedAssets = {
      instruments: new Map(),
      samples: new Map(),
      effects: new Map()
    };
  }

  async loadManifest(manifestUrl: string): Promise<AssetManifest> {
    try {
      const response = await fetch(manifestUrl);
      this.manifest = await response.json();
      console.log('[AE] Loaded asset manifest:', this.manifest!.version);
      return this.manifest!;
    } catch (error) {
      console.warn('[AE] Could not load manifest, using fallback instruments');
      this.manifest = this.getFallbackManifest();
      return this.manifest;
    }
  }

  private getFallbackManifest(): AssetManifest {
    return {
      version: 1,
      instruments: {
        rhodes: { type: 'sf2', url: 'Rhodes_MKII_Piano.sf2', voices: 16 },
        upright_bass: { type: 'sf2', url: 'The_Airfont_Acoustic_Bass.sf2', voices: 12 },
        grand_piano: { type: 'sf2', url: 'Rhodes_MKII_Piano.sf2', voices: 16 },
        strings_ensemble: { type: 'sf2', url: 'Mini_Marcato_Strings.sf2', voices: 12 },
        clarinet: { type: 'sf2', url: 'clarinet.sf2', voices: 8 },
        flute: { type: 'sfz', url: 'MkII_Flute.sfz', voices: 8 },
        french_horn: { type: 'sfz', url: 'GC3_Brass.sfz', voices: 8 },
        pad_choir: { type: 'sf2', url: 'KBH_Real_and_Swell_Choir.sf2', voices: 12 },
        jazz_bass: { type: 'sf2', url: 'Jazz_Club_Bass.sf2', voices: 12 },
        brass_section: { type: 'sf2', url: 'Nyx_SC-88_Horns.sf2', voices: 8 },
        cello: { type: 'sfz', url: 'Cello.sfz', voices: 8 },
        trumpet: { type: 'sfz', url: 'Trumpet.sfz', voices: 8 },
        trombone: { type: 'sfz', url: 'Trombone.sfz', voices: 8 },
        saxophone: { type: 'sfz', url: 'Tenor_Sax.sfz', voices: 8 },
        bassoon: { type: 'sfz', url: 'Bassoon.sfz', voices: 8 },
        vibes: { type: 'sfz', url: 'Vibes.sfz', voices: 8 },
        organ: { type: 'sfz', url: 'Church_Organ.sfz', voices: 12 },
        accordion: { type: 'sfz', url: 'Italian_Accordion.sfz', voices: 8 },
        pad_shimmer: { type: 'sample', url: '/audio/samples/pads/shimmer.wav', voices: 8 },
        bell_mallet: { type: 'sample', url: '/audio/samples/bells/mallet_c4.wav', voices: 8 },
        tr808: { type: 'kit', root: '/audio/samples/drums/808/', voices: 8 },
        tr909: { type: 'kit', root: '/audio/samples/drums/909/', voices: 8 },
        jazz_kit: { type: 'kit', root: '/audio/samples/drums/jazz/', voices: 8 },
        house_kit: { type: 'kit', root: '/audio/samples/drums/909/', voices: 8 },
        orch_perc: { type: 'kit', root: '/audio/samples/drums/orch/', voices: 8 },
        vinyl_noise: { type: 'loop', url: '/audio/samples/lofi/vinyl_loop.wav', voices: 1 }
      },
      irs: {
        hall: '/audio/irs/hall.wav',
        plate: '/audio/irs/plate.wav',
        room: '/audio/irs/room.wav'
      },
      licenses: [
        { name: 'VSCO CE/SSO/WebAudioFont/CC0 kits', url: 'https://musical-artifacts.com/', license: 'CC0/CC-BY (see artifact)' },
        { name: 'OpenAIR IRs', url: 'http://www.openairlib.net/', license: 'CC0' },
        { name: 'SFZ Instruments', url: 'https://github.com/sfzinstruments/SFZInstruments', license: 'CC0' }
      ]
    };
  }

  async loadInstrument(id: string): Promise<LoadedInstrument | LoadedSFZ | null> {
    if (this.loadedAssets.instruments.has(id)) {
      return this.loadedAssets.instruments.get(id)!;
    }

    if (!this.manifest) {
      console.warn('[AE] No manifest loaded, using fallback');
      return null;
    }

    const instrumentConfig = this.manifest.instruments[id];
    if (!instrumentConfig) {
      console.warn(`[AE] Instrument not found in manifest: ${id}`);
      return null;
    }

    try {
      let loadedInstrument: LoadedInstrument | LoadedSFZ;

      if (instrumentConfig.type === 'sf2') {
        if (!instrumentConfig.url) {
          throw new Error(`SF2 instrument ${id} missing url`);
        }
        loadedInstrument = await this.soundFontLoader.load(id, {
          url: instrumentConfig.url,
          voices: instrumentConfig.voices
        });
      } else if (instrumentConfig.type === 'sfz') {
        if (!instrumentConfig.url) {
          throw new Error(`SFZ instrument ${id} missing url`);
        }
        loadedInstrument = await this.sfzLoader.load(id, {
          url: instrumentConfig.url,
          voices: instrumentConfig.voices
        });
      } else if (instrumentConfig.type === 'sample') {
        // For samples, we'll create a synth that mimics the sample
        const synth = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.8 }
        }).toDestination();
        
        // Create a wrapper that matches the LoadedInstrument interface
        loadedInstrument = {
          id,
          sampler: synth as any // Type assertion for compatibility
        };
      } else if (instrumentConfig.type === 'kit') {
        // For drum kits, create a basic drum machine
        const drumMachine = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 10,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
        }).toDestination();
        
        loadedInstrument = {
          id,
          sampler: drumMachine as any // Type assertion for compatibility
        };
      } else if (instrumentConfig.type === 'loop') {
        // For loops, create a player
        const player = new Tone.Player(instrumentConfig.url).toDestination();
        
        loadedInstrument = {
          id,
          sampler: player as any // Type assertion for compatibility
        };
      } else {
        console.warn(`[AE] Unknown instrument type: ${instrumentConfig.type}`);
        return null;
      }

      this.loadedAssets.instruments.set(id, loadedInstrument);
      return loadedInstrument;
    } catch (error) {
      console.error(`[AE] Failed to load instrument ${id}:`, error);
      return null;
    }
  }

  async loadEffect(id: string): Promise<Tone.Convolver | null> {
    if (this.loadedAssets.effects.has(id)) {
      return this.loadedAssets.effects.get(id)!;
    }

    if (!this.manifest) {
      return null;
    }

    const irUrl = this.manifest.irs[id];
    if (!irUrl) {
      console.warn(`[AE] Effect not found in manifest: ${id}`);
      return null;
    }

    try {
      const convolver = new Tone.Convolver(irUrl).toDestination();
      this.loadedAssets.effects.set(id, convolver);
      return convolver;
    } catch (error) {
      console.error(`[AE] Failed to load effect ${id}:`, error);
      return null;
    }
  }

  getInstrument(id: string): LoadedInstrument | LoadedSFZ | null {
    return this.loadedAssets.instruments.get(id) || null;
  }

  getEffect(id: string): Tone.Convolver | null {
    return this.loadedAssets.effects.get(id) || null;
  }

  dispose(): void {
    this.sampleLoader.dispose();
    this.soundFontLoader.dispose();
    this.sfzLoader.dispose();
    
    this.loadedAssets.instruments.forEach(instrument => {
      if (instrument.sampler) {
        instrument.sampler.dispose();
      }
    });
    
    this.loadedAssets.effects.forEach(effect => {
      effect.dispose();
    });
    
    this.loadedAssets.instruments.clear();
    this.loadedAssets.samples.clear();
    this.loadedAssets.effects.clear();
  }
}

// Export the loaders for direct use if needed
export { SampleLoader, SoundFontLoader, SFZLoader };
export type { LoadedSample, SampleConfig, LoadedInstrument, SoundFontConfig, LoadedSFZ, SFZConfig };
