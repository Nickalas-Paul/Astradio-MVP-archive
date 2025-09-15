// Genre Presets - Contains all 6 genre configurations
import { GenrePreset } from '../types';

export class GenrePresets {
  private static presets: Map<string, GenrePreset> = new Map();

  static {
    // Initialize all genre presets
    GenrePresets.initializePresets();
  }

  private static initializePresets(): void {
    // Ambient
    GenrePresets.presets.set('ambient', {
      name: 'Ambient',
      bpm: 65,
      swing: 0.5,
      bus: {
        ir: 'room',
        wet: 0.35,
        eq: { lowCut: 40, highCut: 18000, tilt: 1.2 },
        compressor: { threshold: -20, ratio: 1.5, attack: 0.05, release: 0.3 }
      },
      instruments: {
        pad: { type: 'synth', source: 'ambient_pad' },
        lead: { type: 'synth', source: 'ambient_lead' },
        bass: { type: 'synth', source: 'ambient_bass' }
      },
      drumKit: {
        kick: 'ambient_kick',
        snare: 'ambient_snare',
        hat: 'ambient_hat'
      }
    });

    // Classical
    GenrePresets.presets.set('classical', {
      name: 'Classical',
      bpm: 85,
      swing: 0.5,
      bus: {
        ir: 'hall',
        wet: 0.2,
        eq: { lowCut: 60, highCut: 16000, tilt: 1.0 },
        compressor: { threshold: -16, ratio: 2.0, attack: 0.02, release: 0.2 }
      },
      instruments: {
        pad: { type: 'synth', source: 'classical_pad' },
        lead: { type: 'synth', source: 'classical_lead' },
        bass: { type: 'synth', source: 'classical_bass' }
      },
      drumKit: {
        kick: 'classical_kick',
        snare: 'classical_snare',
        hat: 'classical_hat'
      }
    });

    // Jazz
    GenrePresets.presets.set('jazz', {
      name: 'Jazz',
      bpm: 125,
      swing: 0.58,
      bus: {
        ir: 'room',
        wet: 0.25,
        eq: { lowCut: 50, highCut: 17000, tilt: 1.1 },
        compressor: { threshold: -18, ratio: 2.5, attack: 0.03, release: 0.25 }
      },
      instruments: {
        pad: { type: 'synth', source: 'jazz_pad' },
        lead: { type: 'synth', source: 'jazz_lead' },
        bass: { type: 'synth', source: 'jazz_bass' }
      },
      drumKit: {
        kick: 'jazz_kick',
        snare: 'jazz_snare',
        hat: 'jazz_hat'
      }
    });

    // Electronic
    GenrePresets.presets.set('electronic', {
      name: 'Electronic',
      bpm: 123,
      swing: 0.5,
      bus: {
        ir: 'plate',
        wet: 0.25,
        eq: { lowCut: 30, highCut: 20000, tilt: 1.3 },
        compressor: { threshold: -12, ratio: 3.0, attack: 0.01, release: 0.1 }
      },
      instruments: {
        pad: { type: 'synth', source: 'electronic_pad' },
        lead: { type: 'synth', source: 'electronic_lead' },
        bass: { type: 'synth', source: 'electronic_bass' }
      },
      drumKit: {
        kick: 'electronic_kick',
        snare: 'electronic_snare',
        hat: 'electronic_hat'
      }
    });

    // House
    GenrePresets.presets.set('house', {
      name: 'House',
      bpm: 121,
      swing: 0.56,
      bus: {
        ir: 'room',
        wet: 0.3,
        eq: { lowCut: 35, highCut: 19000, tilt: 1.4 },
        compressor: { threshold: -14, ratio: 2.8, attack: 0.015, release: 0.15 }
      },
      instruments: {
        pad: { type: 'synth', source: 'house_pad' },
        lead: { type: 'synth', source: 'house_lead' },
        bass: { type: 'synth', source: 'house_bass' }
      },
      drumKit: {
        kick: 'house_kick',
        snare: 'house_snare',
        hat: 'house_hat'
      }
    });

    // Lo-Fi
    GenrePresets.presets.set('lofi', {
      name: 'Lo-Fi',
      bpm: 79,
      swing: 0.56,
      bus: {
        ir: 'room',
        wet: 0.25,
        eq: { lowCut: 45, highCut: 12000, tilt: 0.8 },
        compressor: { threshold: -22, ratio: 1.8, attack: 0.08, release: 0.4 }
      },
      instruments: {
        pad: { type: 'synth', source: 'lofi_pad' },
        lead: { type: 'synth', source: 'lofi_lead' },
        bass: { type: 'synth', source: 'lofi_bass' }
      },
      drumKit: {
        kick: 'lofi_kick',
        snare: 'lofi_snare',
        hat: 'lofi_hat'
      }
    });
  }

  static getPreset(genre: string): GenrePreset | null {
    return GenrePresets.presets.get(genre.toLowerCase()) || null;
  }

  static getAllGenres(): string[] {
    return Array.from(GenrePresets.presets.keys());
  }

  static getDefaultGenre(): string {
    return 'ambient';
  }

  static isValidGenre(genre: string): boolean {
    return GenrePresets.presets.has(genre.toLowerCase());
  }
}
