/**
 * Visualization Engine
 * Deterministic viz payload generation with audio sync
 * Uses same FeatureEncoder as audio/text engines
 */

export interface VizFeatures {
  arc_shape: number;
  density_level: number;
  tempo_norm: number;
  step_bias: number;
  syncopation_bias: number;
  motif_rate: number;
  element_dominance: string;
  aspect_tension: number;
  modality: string;
}

export interface AudioMeta {
  bpm: number;
  beatGrid: number[]; // beat times in seconds
  sections: Array<{ start: number; end: number; kind: 'intro' | 'verse' | 'chorus' | 'bridge' }>;
  intensityEnvelope: number[]; // intensity over time
  key?: string;
  mode?: string;
}

export interface VizTimeline {
  beats: Array<{ t: number; event: 'beat'; strength: number }>;
  sections: Array<{ start: number; end: number; kind: 'intro' | 'verse' | 'chorus' | 'bridge' }>;
  astro: Array<{ t: number; feature: string; weight: number }>;
}

export interface VizUniforms {
  rotation: number[];
  scale: number[];
  emission: number[];
  hueShift: number[];
  radialFocus: number[];
}

export interface WheelOverlay {
  highlight: string[];
  aspectLines: Array<{ p1: string; p2: string; type: string }>;
}

export interface VizPayload {
  vizVersion: string;
  duration: number;
  theme: { palette: string[]; accent: string };
  timeline: VizTimeline;
  uniforms: VizUniforms;
  wheelOverlay: WheelOverlay;
  renderer: { type: 'svg' | 'webgl2'; quality: 'low' | 'high' };
}

export interface AudioSync {
  bus: any;
  transport: any;
  onBeat: (beatTime: number, strength: number) => void;
  onSection: (section: any) => void;
}

export class VizEngine {
  private isEnabled: boolean;
  private currentPayload: VizPayload | null = null;
  private audioSync: AudioSync | null = null;

  constructor(isEnabled: boolean = true) {
    this.isEnabled = isEnabled;
  }

  /**
   * Generate deterministic viz payload from features and audio meta
   */
  generateVizPayload(
    features: VizFeatures, 
    seed: string, 
    duration: number, 
    audioMeta: AudioMeta
  ): VizPayload {
    if (!this.isEnabled) {
      return this.getEmptyPayload(duration);
    }

    // Deterministic RNG from seed
    const rand = this.createSeededRNG(seed);
    
    // Generate theme from element dominance
    const theme = this.generateTheme(features.element_dominance, rand);
    
    // Generate timeline from audio meta
    const timeline = this.generateTimeline(audioMeta, features, rand);
    
    // Generate uniforms arrays matching beat grid
    const uniforms = this.generateUniforms(audioMeta.beatGrid, features, rand);
    
    // Generate wheel overlay
    const wheelOverlay = this.generateWheelOverlay(features, rand);
    
    this.currentPayload = {
      vizVersion: '1.0',
      duration,
      theme,
      timeline,
      uniforms,
      wheelOverlay,
      renderer: { type: 'svg', quality: 'high' }
    };
    
    return this.currentPayload;
  }

  /**
   * Attach audio sync for beat/section synchronization
   */
  attachAudioSync(sync: AudioSync): void {
    if (!this.isEnabled) return;
    
    this.audioSync = sync;
    
    // Subscribe to audio events
    if (sync.bus) {
      sync.bus.on('audio.tick', (beatTime: number) => {
        this.handleBeat(beatTime);
      });
      
      sync.bus.on('audio.section', (section: any) => {
        this.handleSection(section);
      });
    }
  }

  /**
   * Detach audio sync
   */
  detachAudioSync(): void {
    if (this.audioSync?.bus) {
      this.audioSync.bus.off('audio.tick');
      this.audioSync.bus.off('audio.section');
    }
    this.audioSync = null;
  }

  /**
   * Handle beat events
   */
  private handleBeat(beatTime: number): void {
    if (!this.audioSync?.onBeat || !this.currentPayload) return;
    
    // Find beat strength from timeline
    const beat = this.currentPayload.timeline.beats.find(b => 
      Math.abs(b.t - beatTime) < 0.1
    );
    
    if (beat) {
      this.audioSync.onBeat(beatTime, beat.strength);
    }
  }

  /**
   * Handle section changes
   */
  private handleSection(section: any): void {
    if (!this.audioSync?.onSection) return;
    
    this.audioSync.onSection(section);
  }

  /**
   * Check if viz engine is ready
   */
  isReady(): boolean {
    return this.isEnabled && this.currentPayload !== null;
  }

  private generateTheme(element: string, rand: () => number): { palette: string[]; accent: string } {
    const hueMap: Record<string, number> = {
      fire: 0,    // Red
      earth: 60,  // Yellow
      air: 180,   // Cyan
      water: 240  // Blue
    };
    
    const baseHue = hueMap[element] || 0;
    const palette = [
      `hsl(${baseHue}, 70%, 50%)`,
      `hsl(${baseHue + 30}, 60%, 60%)`,
      `hsl(${baseHue - 30}, 80%, 40%)`,
      `hsl(${baseHue + 60}, 50%, 70%)`
    ];
    
    return {
      palette,
      accent: `hsl(${baseHue + rand() * 60 - 30}, 80%, 60%)`
    };
  }

  private generateTimeline(audioMeta: AudioMeta, features: VizFeatures, rand: () => number): VizTimeline {
    const beats = audioMeta.beatGrid.map(t => ({
      t,
      event: 'beat' as const,
      strength: 0.5 + features.tempo_norm * 0.5 + (rand() * 0.2 - 0.1)
    }));
    
    const astro = audioMeta.sections.map(section => ({
      t: section.start,
      feature: `aspect:${this.getAspectType(features.aspect_tension)}`,
      weight: features.aspect_tension + (rand() * 0.2 - 0.1)
    }));
    
    return {
      beats,
      sections: audioMeta.sections,
      astro
    };
  }

  private generateUniforms(beatGrid: number[], features: VizFeatures, rand: () => number): VizUniforms {
    return {
      rotation: beatGrid.map(() => rand() * 360 * features.tempo_norm),
      scale: beatGrid.map(() => 0.8 + features.density_level * 0.4 + (rand() * 0.2 - 0.1)),
      emission: beatGrid.map(() => features.motif_rate + (rand() * 0.3 - 0.15)),
      hueShift: beatGrid.map(() => rand() * 60 - 30),
      radialFocus: beatGrid.map(() => features.step_bias + (rand() * 0.4 - 0.2))
    };
  }

  private generateWheelOverlay(features: VizFeatures, rand: () => number): WheelOverlay {
    const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
    const highlight = planets.slice(0, Math.floor(2 + features.density_level * 3));
    
    const aspectTypes = ['conjunction', 'opposition', 'trine', 'square'];
    const aspectLines = Array.from({ length: Math.floor(features.aspect_tension * 4) }, () => ({
      p1: planets[Math.floor(rand() * planets.length)],
      p2: planets[Math.floor(rand() * planets.length)],
      type: aspectTypes[Math.floor(rand() * aspectTypes.length)]
    }));
    
    return { highlight, aspectLines };
  }

  private getAspectType(tension: number): string {
    if (tension < 0.25) return 'trine';
    if (tension < 0.5) return 'sextile';
    if (tension < 0.75) return 'square';
    return 'opposition';
  }

  private getEmptyPayload(duration: number): VizPayload {
    return {
      vizVersion: '1.0',
      duration,
      theme: { palette: ['#666'], accent: '#999' },
      timeline: { beats: [], sections: [], astro: [] },
      uniforms: { rotation: [], scale: [], emission: [], hueShift: [], radialFocus: [] },
      wheelOverlay: { highlight: [], aspectLines: [] },
      renderer: { type: 'svg', quality: 'low' }
    };
  }

  private createSeededRNG(seed: string): () => number {
    let state = 0;
    for (let i = 0; i < seed.length; i++) {
      state = (state ^ seed.charCodeAt(i)) >>> 0;
      state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
      state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
    }
    if (state === 0) state = 0x9E3779B9;
    
    return () => {
      state ^= state << 13; state >>>= 0;
      state ^= state >>> 17; state >>>= 0;
      state ^= state << 5;  state >>>= 0;
      return (state >>> 0) / 0xFFFFFFFF;
    };
  }
}

// Export singleton instance
export const vizEngine = new VizEngine();
