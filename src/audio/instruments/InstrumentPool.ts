import * as Tone from 'tone';

export interface GenreInstruments {
  melody: string;
  pad: string;
  bass: string;
  eq: any;
}

export class InstrumentPool {
  private instruments: Map<string, Tone.ToneAudioNode> = new Map();
  private genrePresets: Map<string, GenreInstruments> = new Map();

  constructor() {
    this.initializeGenrePresets();
  }

  private initializeGenrePresets() {
    // Define four distinct genre presets
    this.genrePresets.set('ambient', {
      melody: 'pad.glass',
      pad: 'pad.warm',
      bass: 'bass.sub',
      eq: { lowShelf: -2, hiShelf: 2, lowFreq: 120, hiFreq: 8000 }
    });

    this.genrePresets.set('jazz', {
      melody: 'lead.sax',
      pad: 'keys.rhodes',
      bass: 'bass.upright',
      eq: { midBell: 2, hiShelf: -1, midFreq: 1000, hiFreq: 6000 }
    });

    this.genrePresets.set('orchestral', {
      melody: 'lead.violin',
      pad: 'strings.ensemble',
      bass: 'bass.cellos',
      eq: { lowShelf: 2, hiShelf: 1, lowFreq: 150, hiFreq: 10000 }
    });

    this.genrePresets.set('house', {
      melody: 'lead.saw',
      pad: 'pad.pluck',
      bass: 'bass.303',
      eq: { lowShelf: 3, hiShelf: 2, lowFreq: 80, hiFreq: 10000 }
    });

    // Add fallback for other genres
    this.genrePresets.set('classical', this.genrePresets.get('orchestral')!);
    this.genrePresets.set('electronic', this.genrePresets.get('house')!);
    this.genrePresets.set('lofi', this.genrePresets.get('ambient')!);
  }

  async getInstrumentsForGenre(genre: string): Promise<GenreInstruments> {
    const preset = this.genrePresets.get(genre) || this.genrePresets.get('ambient')!;
    
    console.log('[INSTRUMENTS]', genre, preset);
    
    return preset;
  }

  async getInstrumentId(genre: string, role: 'melody' | 'pad' | 'bass'): Promise<string> {
    const instruments = await this.getInstrumentsForGenre(genre);
    return instruments[role];
  }

  async createInstrument(instrumentId: string): Promise<Tone.ToneAudioNode> {
    if (this.instruments.has(instrumentId)) {
      return this.instruments.get(instrumentId)!;
    }

    let instrument: Tone.ToneAudioNode;

    // Create instruments based on ID
    if (instrumentId.includes('pad.glass')) {
      instrument = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 2, decay: 0.5, sustain: 0.3, release: 4 }
      });
    } else if (instrumentId.includes('pad.warm')) {
      instrument = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 1, decay: 0.3, sustain: 0.7, release: 2 }
      });
    } else if (instrumentId.includes('lead.sax')) {
      instrument = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { frequency: 800, type: 'lowpass' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.8 }
      });
    } else if (instrumentId.includes('keys.rhodes')) {
      instrument = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        filter: { frequency: 1200, type: 'lowpass' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 1 }
      });
    } else if (instrumentId.includes('lead.violin')) {
      instrument = new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        filter: { frequency: 2000, type: 'lowpass' },
        envelope: { attack: 0.3, decay: 0.1, sustain: 0.8, release: 1.5 }
      });
    } else if (instrumentId.includes('strings.ensemble')) {
      instrument = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        filter: { frequency: 1500, type: 'lowpass' },
        envelope: { attack: 0.5, decay: 0.2, sustain: 0.9, release: 2 }
      });
    } else if (instrumentId.includes('lead.saw')) {
      instrument = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { frequency: 1000, type: 'lowpass' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 }
      });
    } else if (instrumentId.includes('pad.pluck')) {
      instrument = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        filter: { frequency: 800, type: 'lowpass' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.5 }
      });
    } else if (instrumentId.includes('bass.sub')) {
      instrument = new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        filter: { frequency: 200, type: 'lowpass' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 }
      });
    } else if (instrumentId.includes('bass.upright')) {
      instrument = new Tone.MonoSynth({
        oscillator: { type: 'triangle' },
        filter: { frequency: 300, type: 'lowpass' },
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.8 }
      });
    } else if (instrumentId.includes('bass.cellos')) {
      instrument = new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        filter: { frequency: 250, type: 'lowpass' },
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.8, release: 1 }
      });
    } else if (instrumentId.includes('bass.303')) {
      instrument = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { frequency: 150, type: 'lowpass' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 }
      });
    } else {
      // Fallback to basic synth
      instrument = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.8 }
      });
    }

    this.instruments.set(instrumentId, instrument);
    return instrument;
  }

  applyGenreEQ(instrument: Tone.ToneAudioNode, genre: string): void {
    const preset = this.genrePresets.get(genre);
    if (!preset) return;

    const eq = preset.eq;
    
    // Apply EQ settings
    if (eq.lowShelf !== undefined) {
      const lowShelf = new Tone.Lowpass(eq.lowFreq || 200);
      lowShelf.gain.value = eq.lowShelf;
      instrument.chain(lowShelf, Tone.Destination);
    }
    
    if (eq.hiShelf !== undefined) {
      const hiShelf = new Tone.Highpass(eq.hiFreq || 8000);
      hiShelf.gain.value = eq.hiShelf;
      instrument.chain(hiShelf, Tone.Destination);
    }
    
    if (eq.midBell !== undefined) {
      const midBell = new Tone.Filter(eq.midFreq || 1000, 'peaking');
      midBell.Q.value = 1;
      midBell.gain.value = eq.midBell;
      instrument.chain(midBell, Tone.Destination);
    }
  }

  // Remove any legacy scale generation methods
  // These should throw errors if called
  generateScale(): never {
    throw new Error('Deprecated fallback used: generateScale() - Use unified Engine instead');
  }

  playScale(): never {
    throw new Error('Deprecated fallback used: playScale() - Use unified Engine instead');
  }

  simpleScale(): never {
    throw new Error('Deprecated fallback used: simpleScale() - Use unified Engine instead');
  }

  dispose(): void {
    this.instruments.forEach(instrument => {
      if (instrument.dispose) {
        instrument.dispose();
      }
    });
    this.instruments.clear();
  }
}
