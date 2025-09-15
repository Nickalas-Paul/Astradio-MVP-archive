import * as Tone from 'tone';

export interface LoadedSample {
  id: string;
  player?: Tone.Player;
  sampler?: Tone.Sampler;
}

export interface SampleConfig {
  url: string;
  type: 'single' | 'multi';
  baseNote?: string;
  notes?: string[];
  velocity?: number;
}

export class SampleLoader {
  private loadedSamples: Map<string, LoadedSample> = new Map();

  async load(id: string, config: SampleConfig): Promise<LoadedSample> {
    if (this.loadedSamples.has(id)) {
      return this.loadedSamples.get(id)!;
    }

    let loadedSample: LoadedSample;

    if (config.type === 'multi' && config.notes) {
      // Create a sampler for multi-note instruments
      const urls: Record<string, string> = {};
      config.notes.forEach(note => {
        urls[note] = config.url.replace('{note}', note);
      });

      const sampler = new Tone.Sampler({
        urls,
        baseUrl: config.url.split('/').slice(0, -1).join('/') + '/',
        onload: () => {
          console.log(`[AE] Loaded sampler: ${id}`);
        }
      }).toDestination();

      loadedSample = { id, sampler };
    } else {
      // Create a player for single samples
      const player = new Tone.Player({
        url: config.url,
        onload: () => {
          console.log(`[AE] Loaded sample: ${id}`);
        }
      }).toDestination();

      loadedSample = { id, player };
    }

    this.loadedSamples.set(id, loadedSample);
    return loadedSample;
  }

  async loadDrumKit(id: string, kitConfig: Record<string, string>): Promise<LoadedSample> {
    if (this.loadedSamples.has(id)) {
      return this.loadedSamples.get(id)!;
    }

    const urls: Record<string, string> = {};
    Object.entries(kitConfig).forEach(([drum, url]) => {
      urls[drum] = url;
    });

    const sampler = new Tone.Sampler({
      urls,
      baseUrl: '/audio/samples/drums/',
      onload: () => {
        console.log(`[AE] Loaded drum kit: ${id}`);
      }
    }).toDestination();

    const loadedSample = { id, sampler };
    this.loadedSamples.set(id, loadedSample);
    return loadedSample;
  }

  getSample(id: string): LoadedSample | undefined {
    return this.loadedSamples.get(id);
  }

  dispose(): void {
    this.loadedSamples.forEach(sample => {
      if (sample.player) {
        sample.player.dispose();
      }
      if (sample.sampler) {
        sample.sampler.dispose();
      }
    });
    this.loadedSamples.clear();
  }
}
