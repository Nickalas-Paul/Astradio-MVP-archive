import * as Tone from 'tone';

export interface TransitionConfig {
  duration: number;      // Transition duration in seconds
  type: 'fade' | 'crossfade' | 'modulation' | 'rhythmic' | 'harmonic';
  easing: 'linear' | 'exponential' | 'sine' | 'cosine';
  overlap: number;       // Overlap between sections (0-1)
}

export interface MusicalTransition {
  fromKey: string;
  toKey: string;
  fromTempo: number;
  toTempo: number;
  fromMode: string;
  toMode: string;
  duration: number;
  pivotChord?: string;
  modulationType: 'direct' | 'pivot' | 'chromatic' | 'diatonic';
}

export class TransitionManager {
  private currentTransition: MusicalTransition | null = null;
  private transitionProgress = 0;
  private crossfadeNode: Tone.CrossFade;
  private volumeFader: Tone.Volume;
  private filterFader: Tone.Filter;
  
  constructor() {
    this.crossfadeNode = new Tone.CrossFade(0.5);
    this.volumeFader = new Tone.Volume(0);
    this.filterFader = new Tone.Filter({
      frequency: 20000,
      type: 'lowpass'
    });
    
    this.setupChain();
  }
  
  private setupChain() {
    this.volumeFader.connect(this.filterFader);
    this.filterFader.connect(this.crossfadeNode);
    this.crossfadeNode.toDestination();
  }
  
  /**
   * Create smooth transition between musical sections
   */
  createTransition(
    fromSection: any,
    toSection: any,
    config: TransitionConfig
  ): MusicalTransition {
    const transition: MusicalTransition = {
      fromKey: fromSection.key || 'C',
      toKey: toSection.key || 'C',
      fromTempo: fromSection.tempo || 120,
      toTempo: toSection.tempo || 120,
      fromMode: fromSection.mode || 'major',
      toMode: toSection.mode || 'major',
      duration: config.duration,
      modulationType: this.determineModulationType(fromSection, toSection)
    };
    
    // Find pivot chord for modulation
    if (transition.modulationType === 'pivot') {
      transition.pivotChord = this.findPivotChord(transition);
    }
    
    this.currentTransition = transition;
    this.transitionProgress = 0;
    
    return transition;
  }
  
  /**
   * Execute transition over time
   */
  executeTransition(progress: number): void {
    if (!this.currentTransition) return;
    
    this.transitionProgress = Math.max(0, Math.min(1, progress));
    
    // Apply crossfade
    this.crossfadeNode.fade.value = this.transitionProgress;
    
    // Apply volume fade
    const volume = this.calculateTransitionVolume(progress);
    this.volumeFader.volume.value = Tone.gainToDb(volume);
    
    // Apply filter transition
    const filterFreq = this.calculateTransitionFilter(progress);
    this.filterFader.frequency.value = filterFreq;
    
    // Apply tempo transition
    const tempo = this.calculateTransitionTempo(progress);
    Tone.Transport.bpm.value = tempo;
  }
  
  /**
   * Determine modulation type
   */
  private determineModulationType(fromSection: any, toSection: any): MusicalTransition['modulationType'] {
    const fromKey = fromSection.key || 'C';
    const toKey = toSection.key || 'C';
    
    if (fromKey === toKey) return 'direct';
    
    // Check for pivot chord modulation
    if (this.hasCommonChord(fromKey, toKey)) return 'pivot';
    
    // Check for chromatic modulation
    if (this.isChromaticModulation(fromKey, toKey)) return 'chromatic';
    
    return 'diatonic';
  }
  
  /**
   * Find pivot chord for modulation
   */
  private findPivotChord(transition: MusicalTransition): string {
    const fromKey = transition.fromKey;
    const toKey = transition.toKey;
    
    // Common chords between keys
    const commonChords = this.getCommonChords(fromKey, toKey);
    
    if (commonChords.length > 0) {
      // Choose the most stable pivot chord
      const stableChords = ['I', 'IV', 'V'];
      const stablePivot = commonChords.find(chord => stableChords.includes(chord));
      return stablePivot || commonChords[0];
    }
    
    return 'I'; // Default pivot
  }
  
  /**
   * Check if keys have common chords
   */
  private hasCommonChord(key1: string, key2: string): boolean {
    const chords1 = this.getKeyChords(key1);
    const chords2 = this.getKeyChords(key2);
    
    return chords1.some(chord => chords2.includes(chord));
  }
  
  /**
   * Get common chords between keys
   */
  private getCommonChords(key1: string, key2: string): string[] {
    const chords1 = this.getKeyChords(key1);
    const chords2 = this.getKeyChords(key2);
    
    return chords1.filter(chord => chords2.includes(chord));
  }
  
  /**
   * Get chords in a key
   */
  private getKeyChords(key: string): string[] {
    const majorChords = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const minorChords = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
    
    // Simplified - assume major for now
    return majorChords;
  }
  
  /**
   * Check if modulation is chromatic
   */
  private isChromaticModulation(fromKey: string, toKey: string): boolean {
    const semitones = this.getSemitoneDistance(fromKey, toKey);
    return semitones % 12 !== 0; // Not a perfect octave
  }
  
  /**
   * Get semitone distance between keys
   */
  private getSemitoneDistance(key1: string, key2: string): number {
    const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const index1 = noteOrder.indexOf(key1);
    const index2 = noteOrder.indexOf(key2);
    
    if (index1 === -1 || index2 === -1) return 0;
    
    return (index2 - index1 + 12) % 12;
  }
  
  /**
   * Calculate transition volume
   */
  private calculateTransitionVolume(progress: number): number {
    // Smooth volume curve
    return 0.5 + 0.5 * Math.sin(progress * Math.PI);
  }
  
  /**
   * Calculate transition filter frequency
   */
  private calculateTransitionFilter(progress: number): number {
    // Start with full frequency, dip in middle, return to full
    const dip = Math.sin(progress * Math.PI) * 0.3;
    return 20000 * (1 - dip);
  }
  
  /**
   * Calculate transition tempo
   */
  private calculateTransitionTempo(progress: number): number {
    if (!this.currentTransition) return 120;
    
    const fromTempo = this.currentTransition.fromTempo;
    const toTempo = this.currentTransition.toTempo;
    
    // Smooth tempo transition
    return fromTempo + (toTempo - fromTempo) * this.easeInOut(progress);
  }
  
  /**
   * Easing function for smooth transitions
   */
  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
  
  /**
   * Create genre-specific transitions
   */
  createGenreTransition(genre: string, fromSection: any, toSection: any): MusicalTransition {
    const configs = {
      classical: { duration: 2.0, type: 'modulation' as const, easing: 'sine' as const, overlap: 0.3 },
      jazz: { duration: 1.5, type: 'harmonic' as const, easing: 'sine' as const, overlap: 0.4 },
      electronic: { duration: 1.0, type: 'crossfade' as const, easing: 'linear' as const, overlap: 0.5 },
      house: { duration: 0.8, type: 'rhythmic' as const, easing: 'linear' as const, overlap: 0.6 },
      lofi: { duration: 2.5, type: 'fade' as const, easing: 'cosine' as const, overlap: 0.2 },
      ambient: { duration: 3.0, type: 'fade' as const, easing: 'exponential' as const, overlap: 0.1 }
    };
    
    const config = configs[genre as keyof typeof configs] || configs.ambient;
    return this.createTransition(fromSection, toSection, config);
  }
  
  /**
   * Create elemental transitions
   */
  createElementalTransition(element: string, fromSection: any, toSection: any): MusicalTransition {
    const configs = {
      fire: { duration: 1.2, type: 'modulation' as const, easing: 'exponential' as const, overlap: 0.4 },
      earth: { duration: 2.0, type: 'harmonic' as const, easing: 'sine' as const, overlap: 0.3 },
      air: { duration: 1.8, type: 'crossfade' as const, easing: 'cosine' as const, overlap: 0.5 },
      water: { duration: 2.5, type: 'fade' as const, easing: 'sine' as const, overlap: 0.2 }
    };
    
    const config = configs[element as keyof typeof configs] || configs.air;
    return this.createTransition(fromSection, toSection, config);
  }
  
  /**
   * Connect input to transition manager
   */
  connectInput(input: Tone.ToneAudioNode): void {
    input.connect(this.volumeFader);
  }
  
  /**
   * Get current transition state
   */
  getCurrentTransition(): MusicalTransition | null {
    return this.currentTransition;
  }
  
  /**
   * Get transition progress
   */
  getTransitionProgress(): number {
    return this.transitionProgress;
  }
  
  /**
   * Reset transition state
   */
  reset(): void {
    this.currentTransition = null;
    this.transitionProgress = 0;
    this.crossfadeNode.fade.value = 0.5;
    this.volumeFader.volume.value = 0;
    this.filterFader.frequency.value = 20000;
  }
  
  /**
   * Disconnect and cleanup
   */
  dispose(): void {
    this.crossfadeNode.dispose();
    this.volumeFader.dispose();
    this.filterFader.dispose();
  }
}
