import * as Tone from 'tone';

export interface LoadedInstrument {
  id: string;
  sampler: Tone.Sampler;
}

export interface SoundFontConfig {
  url: string;
  voices?: number;
  baseNote?: string;
  notes?: string[];
}

export class SoundFontLoader {
  private loadedInstruments: Map<string, LoadedInstrument> = new Map();

  async load(id: string, config: SoundFontConfig): Promise<LoadedInstrument> {
    if (this.loadedInstruments.has(id)) {
      return this.loadedInstruments.get(id)!;
    }

    // Create a sampler for the SoundFont
    const sampler = new Tone.Sampler({
      urls: {
        [config.baseNote || 'C4']: config.url
      },
      baseUrl: '/audio/soundfonts/',
      onload: () => {
        console.log(`[AE] Loaded SoundFont: ${id}`);
      },
      release: 1,
      attack: 0.1
    }).toDestination();

    const loadedInstrument = { id, sampler };
    this.loadedInstruments.set(id, loadedInstrument);
    return loadedInstrument;
  }

  async loadMultiNote(id: string, config: SoundFontConfig): Promise<LoadedInstrument> {
    if (this.loadedInstruments.has(id)) {
      return this.loadedInstruments.get(id)!;
    }

    if (!config.notes) {
      throw new Error(`Multi-note SoundFont requires notes array: ${id}`);
    }

    const urls: Record<string, string> = {};
    config.notes.forEach(note => {
      urls[note] = config.url;
    });

    const sampler = new Tone.Sampler({
      urls,
      baseUrl: '/audio/soundfonts/',
      onload: () => {
        console.log(`[AE] Loaded multi-note SoundFont: ${id}`);
      },
      release: 1,
      attack: 0.1
    }).toDestination();

    const loadedInstrument = { id, sampler };
    this.loadedInstruments.set(id, loadedInstrument);
    return loadedInstrument;
  }

  getInstrument(id: string): LoadedInstrument | undefined {
    return this.loadedInstruments.get(id);
  }

  dispose(): void {
    this.loadedInstruments.forEach(instrument => {
      if (instrument.sampler) {
        instrument.sampler.dispose();
      }
    });
    this.loadedInstruments.clear();
  }
}
