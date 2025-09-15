import * as Tone from 'tone';

export interface SpectralProfile {
  bass: number;      // 20-250 Hz
  lowMid: number;    // 250-500 Hz
  mid: number;       // 500-2000 Hz
  highMid: number;   // 2000-4000 Hz
  high: number;      // 4000-8000 Hz
  air: number;       // 8000-20000 Hz
}

export interface HarmonicContent {
  fundamental: number;
  harmonics: number[];
  richness: number;  // 0-1
  brightness: number; // 0-1
  warmth: number;    // 0-1
}

export interface SpectralBalance {
  profile: SpectralProfile;
  harmonicContent: HarmonicContent;
  overallBalance: number; // -1 (dark) to 1 (bright)
  fullness: number;       // 0-1
}

export class AudioSpectrumManager {
  private analyzer: Tone.Analyser;
  private eqChain: Tone.EQ3[];
  private compressor: Tone.Compressor;
  private limiter: Tone.Limiter;
  private spectrumData: Float32Array;
  
  constructor() {
    this.analyzer = new Tone.Analyser({
      type: 'fft',
      size: 2048
    });
    
    this.eqChain = [
      new Tone.EQ3({ low: 0, mid: 0, high: 0 }),
      new Tone.EQ3({ low: 0, mid: 0, high: 0 })
    ];
    
    this.compressor = new Tone.Compressor({
      threshold: -20,
      ratio: 2,
      attack: 0.02,
      release: 0.2
    });
    
    this.limiter = new Tone.Limiter(-0.1);
    this.spectrumData = new Float32Array(1024);
    
    this.setupChain();
  }
  
  private setupChain() {
    // Connect EQ chain
    this.eqChain[0].connect(this.eqChain[1]);
    this.eqChain[1].connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(this.analyzer);
    this.analyzer.toDestination();
  }
  
  /**
   * Apply spectral profile to audio
   */
  applySpectralProfile(profile: SpectralProfile): void {
    // First EQ for broad shaping
    this.eqChain[0].low.value = profile.bass;
    this.eqChain[0].mid.value = profile.mid;
    this.eqChain[0].high.value = profile.high;
    
    // Second EQ for fine tuning
    this.eqChain[1].low.value = profile.lowMid * 0.5;
    this.eqChain[1].mid.value = profile.highMid * 0.5;
    this.eqChain[1].high.value = profile.air * 0.5;
  }
  
  /**
   * Get current spectral analysis
   */
  getSpectralAnalysis(): SpectralBalance {
    this.analyzer.getValue();
    const data = this.analyzer.getValue() as Float32Array;
    
    const profile = this.analyzeFrequencyBands(data);
    const harmonicContent = this.analyzeHarmonicContent(data);
    const overallBalance = this.calculateOverallBalance(profile);
    const fullness = this.calculateFullness(profile);
    
    return {
      profile,
      harmonicContent,
      overallBalance,
      fullness
    };
  }
  
  /**
   * Analyze frequency bands
   */
  private analyzeFrequencyBands(data: Float32Array): SpectralProfile {
    const sampleRate = Tone.context.sampleRate;
    const fftSize = data.length;
    
    // Frequency bands (Hz)
    const bands = {
      bass: [20, 250],
      lowMid: [250, 500],
      mid: [500, 2000],
      highMid: [2000, 4000],
      high: [4000, 8000],
      air: [8000, 20000]
    };
    
    const profile: SpectralProfile = {
      bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, air: 0
    };
    
    for (const [band, [lowFreq, highFreq]] of Object.entries(bands)) {
      const lowBin = Math.floor(lowFreq * fftSize / sampleRate);
      const highBin = Math.floor(highFreq * fftSize / sampleRate);
      
      let sum = 0;
      let count = 0;
      
      for (let i = lowBin; i <= highBin && i < data.length; i++) {
        sum += data[i];
        count++;
      }
      
      profile[band as keyof SpectralProfile] = count > 0 ? sum / count : 0;
    }
    
    return profile;
  }
  
  /**
   * Analyze harmonic content
   */
  private analyzeHarmonicContent(data: Float32Array): HarmonicContent {
    // Find fundamental frequency (strongest peak)
    let maxIndex = 0;
    let maxValue = 0;
    
    for (let i = 0; i < data.length / 2; i++) {
      if (data[i] > maxValue) {
        maxValue = data[i];
        maxIndex = i;
      }
    }
    
    const sampleRate = Tone.context.sampleRate;
    const fundamental = maxIndex * sampleRate / data.length;
    
    // Find harmonics
    const harmonics: number[] = [];
    for (let harmonic = 2; harmonic <= 8; harmonic++) {
      const harmonicFreq = fundamental * harmonic;
      const harmonicBin = Math.floor(harmonicFreq * data.length / sampleRate);
      
      if (harmonicBin < data.length) {
        harmonics.push(data[harmonicBin]);
      }
    }
    
    // Calculate richness (harmonic content)
    const richness = harmonics.reduce((sum, h) => sum + h, 0) / harmonics.length;
    
    // Calculate brightness (high frequency content)
    const brightness = this.calculateBrightness(data);
    
    // Calculate warmth (low frequency content)
    const warmth = this.calculateWarmth(data);
    
    return {
      fundamental,
      harmonics,
      richness: Math.min(1, richness),
      brightness: Math.min(1, brightness),
      warmth: Math.min(1, warmth)
    };
  }
  
  /**
   * Calculate brightness (high frequency energy)
   */
  private calculateBrightness(data: Float32Array): number {
    const sampleRate = Tone.context.sampleRate;
    const highFreqStart = Math.floor(4000 * data.length / sampleRate);
    const highFreqEnd = Math.floor(8000 * data.length / sampleRate);
    
    let sum = 0;
    let count = 0;
    
    for (let i = highFreqStart; i <= highFreqEnd && i < data.length; i++) {
      sum += data[i];
      count++;
    }
    
    return count > 0 ? sum / count : 0;
  }
  
  /**
   * Calculate warmth (low frequency energy)
   */
  private calculateWarmth(data: Float32Array): number {
    const sampleRate = Tone.context.sampleRate;
    const lowFreqStart = Math.floor(20 * data.length / sampleRate);
    const lowFreqEnd = Math.floor(500 * data.length / sampleRate);
    
    let sum = 0;
    let count = 0;
    
    for (let i = lowFreqStart; i <= lowFreqEnd && i < data.length; i++) {
      sum += data[i];
      count++;
    }
    
    return count > 0 ? sum / count : 0;
  }
  
  /**
   * Calculate overall spectral balance
   */
  private calculateOverallBalance(profile: SpectralProfile): number {
    const lowEnergy = profile.bass + profile.lowMid;
    const highEnergy = profile.high + profile.air;
    
    if (lowEnergy + highEnergy === 0) return 0;
    
    return (highEnergy - lowEnergy) / (highEnergy + lowEnergy);
  }
  
  /**
   * Calculate fullness (overall energy)
   */
  private calculateFullness(profile: SpectralProfile): number {
    const totalEnergy = Object.values(profile).reduce((sum, val) => sum + val, 0);
    return Math.min(1, totalEnergy / 6); // Normalize to 0-1
  }
  
  /**
   * Apply genre-specific spectral profiles
   */
  applyGenreProfile(genre: string): void {
    const profiles = {
      classical: {
        bass: 0.3, lowMid: 0.4, mid: 0.6, highMid: 0.5, high: 0.4, air: 0.3
      },
      jazz: {
        bass: 0.5, lowMid: 0.6, mid: 0.7, highMid: 0.5, high: 0.4, air: 0.3
      },
      electronic: {
        bass: 0.8, lowMid: 0.6, mid: 0.5, highMid: 0.7, high: 0.8, air: 0.6
      },
      house: {
        bass: 0.9, lowMid: 0.7, mid: 0.5, highMid: 0.6, high: 0.7, air: 0.5
      },
      lofi: {
        bass: 0.4, lowMid: 0.5, mid: 0.6, highMid: 0.3, high: 0.2, air: 0.1
      },
      ambient: {
        bass: 0.3, lowMid: 0.4, mid: 0.5, highMid: 0.6, high: 0.7, air: 0.8
      }
    };
    
    const profile = profiles[genre as keyof typeof profiles] || profiles.ambient;
    this.applySpectralProfile(profile);
  }
  
  /**
   * Apply elemental spectral profiles
   */
  applyElementalProfile(element: string): void {
    const profiles = {
      fire: {
        bass: 0.6, lowMid: 0.7, mid: 0.8, highMid: 0.7, high: 0.6, air: 0.5
      },
      earth: {
        bass: 0.7, lowMid: 0.8, mid: 0.6, highMid: 0.4, high: 0.3, air: 0.2
      },
      air: {
        bass: 0.3, lowMid: 0.4, mid: 0.6, highMid: 0.7, high: 0.8, air: 0.9
      },
      water: {
        bass: 0.5, lowMid: 0.6, mid: 0.7, highMid: 0.5, high: 0.4, air: 0.3
      }
    };
    
    const profile = profiles[element as keyof typeof profiles] || profiles.air;
    this.applySpectralProfile(profile);
  }
  
  /**
   * Connect input to spectrum manager
   */
  connectInput(input: Tone.ToneAudioNode): void {
    input.connect(this.eqChain[0]);
  }
  
  /**
   * Disconnect and cleanup
   */
  dispose(): void {
    this.analyzer.dispose();
    this.eqChain.forEach(eq => eq.dispose());
    this.compressor.dispose();
    this.limiter.dispose();
  }
}
