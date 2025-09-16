// generator.ts - Rules-driven composition generator using existing AudioEngine

import { ChartContext, Vector6, Composition, CompositionEvent } from './contracts';

export class Generator {
  generate(chart: ChartContext, vector: Vector6): Composition {
    try {
      // Use existing AudioEngine to generate composition
      const composition = this.callAudioEngine(chart, vector);
      
      // Normalize events to ensure flat array format
      const normalizedEvents = this.normalizeEvents(composition.events || []);
      
      return {
        events: normalizedEvents,
        analysis: composition.analysis,
        meta: {
          bpm: composition.meta?.bpm || 120,
          key: composition.meta?.key,
          scale: composition.meta?.scale
        }
      };
      
    } catch (error) {
      throw new Error(`Composition generation failed: ${error.message}`);
    }
  }

  private callAudioEngine(chart: ChartContext, vector: Vector6): any {
    // Integrate with existing AudioEngine
    if (typeof window !== 'undefined' && window.audioEngine) {
      try {
        // Convert vector to engine parameters
        const params = this.vectorToEngineParams(vector);
        
        // Generate composition using existing engine
        const composition = window.audioEngine.generateComposition({
          chart: chart,
          vector: vector,
          params: params
        });
        
        return composition;
      } catch (error) {
        throw new Error(`AudioEngine error: ${error.message}`);
      }
    } else {
      throw new Error('AudioEngine not available');
    }
  }

  private vectorToEngineParams(vector: Vector6): any {
    // Map 6-D vector to engine parameters
    const [tempo_energy, rhythm_density, harmonic_tension, brightness, texture_space, melodic_activity] = vector;
    
    return {
      bpm: Math.round(80 + tempo_energy * 80), // 80-160 BPM
      key: this.selectKey(harmonic_tension),
      scale: this.selectScale(harmonic_tension),
      noteDensity: rhythm_density,
      brightness: brightness,
      texture: texture_space,
      melodicActivity: melodic_activity
    };
  }

  private selectKey(tension: number): string {
    const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab'];
    const index = Math.floor(tension * keys.length);
    return keys[Math.min(index, keys.length - 1)];
  }

  private selectScale(tension: number): string {
    const scales = ['major', 'minor', 'dorian', 'mixolydian', 'lydian', 'phrygian'];
    const index = Math.floor(tension * scales.length);
    return scales[Math.min(index, scales.length - 1)];
  }

  private normalizeEvents(events: any[]): CompositionEvent[] {
    if (!Array.isArray(events)) {
      return [];
    }

    return events.map(event => {
      // Normalize event to CompositionEvent format
      if (event.type === 'note' || event.type === 'chord' || event.type === 'perc') {
        return {
          type: event.type,
          t: event.t || event.time || 0,
          dur: event.dur || event.duration || 0,
          pitch: event.pitch || event.note || 0,
          pitches: event.pitches || [],
          vel: event.vel || event.velocity || 0.8,
          id: event.id || 'default'
        } as CompositionEvent;
      }
      
      // Default to note if type is unrecognized
      return {
        type: 'note',
        t: event.t || event.time || 0,
        dur: event.dur || event.duration || 0,
        pitch: event.pitch || event.note || 60,
        vel: event.vel || event.velocity || 0.8
      } as CompositionEvent;
    });
  }
}
