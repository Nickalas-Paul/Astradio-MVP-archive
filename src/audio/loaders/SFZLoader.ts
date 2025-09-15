import * as Tone from 'tone';

export interface LoadedSFZ {
  id: string;
  sampler: Tone.Sampler;
}

export interface SFZConfig {
  url: string;
  voices?: number;
  baseNote?: string;
  notes?: string[];
}

export class SFZLoader {
  private loadedInstruments: Map<string, LoadedSFZ> = new Map();

  async load(id: string, config: SFZConfig): Promise<LoadedSFZ> {
    if (this.loadedInstruments.has(id)) {
      return this.loadedInstruments.get(id)!;
    }

    // For SFZ files, we'll use a simple sampler approach
    // SFZ files are more complex but we can handle basic cases
    const sampler = new Tone.Sampler({
      urls: {
        [config.baseNote || 'C4']: config.url
      },
      baseUrl: '/audio/soundfonts/',
      onload: () => {
        console.log(`[AE] Loaded SFZ: ${id}`);
      },
      release: 1,
      attack: 0.1
    }).toDestination();

    const loadedInstrument = { id, sampler };
    this.loadedInstruments.set(id, loadedInstrument);
    return loadedInstrument;
  }

  async loadMultiNote(id: string, config: SFZConfig): Promise<LoadedSFZ> {
    if (this.loadedInstruments.has(id)) {
      return this.loadedInstruments.get(id)!;
    }

    if (!config.notes) {
      throw new Error(`Multi-note SFZ requires notes array: ${id}`);
    }

    const urls: Record<string, string> = {};
    config.notes.forEach(note => {
      urls[note] = config.url;
    });

    const sampler = new Tone.Sampler({
      urls,
      baseUrl: '/audio/soundfonts/',
      onload: () => {
        console.log(`[AE] Loaded multi-note SFZ: ${id}`);
      },
      release: 1,
      attack: 0.1
    }).toDestination();

    const loadedInstrument = { id, sampler };
    this.loadedInstruments.set(id, loadedInstrument);
    return loadedInstrument;
  }

  getInstrument(id: string): LoadedSFZ | undefined {
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
