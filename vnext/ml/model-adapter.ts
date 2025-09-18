// vnext/ml/model-adapter.ts
// Adapter layer to convert Student-v2 multi-head outputs to 6D control vector
// Maintains runtime API stability while enabling v2 deployment

import { FeatureVec } from "../contracts";

export interface StudentV2Outputs {
  tempo: number;        // 0..1
  brightness: number;   // 0..1  
  density: number;      // 0..1
  arc: number;          // 0..1
  motif: number[];      // 8-element softmax (sums to 1)
  cadence: number[];    // 4-element softmax (sums to 1)
}

export interface ControlVector6D {
  tempo: number;        // 0..1
  brightness: number;   // 0..1
  density: number;      // 0..1
  arc: number;          // 0..1
  motifSelection: number; // 0..7 (discrete motif index)
  cadenceSelection: number; // 0..3 (discrete cadence index)
}

export interface CalibrationParams {
  tempo: { scale: number; offset: number };
  brightness: { scale: number; offset: number };
  density: { scale: number; offset: number };
  arc: { scale: number; offset: number };
  motif: { temperature: number }; // Softmax temperature for motif selection
  cadence: { temperature: number }; // Softmax temperature for cadence selection
}

export class StudentV2Adapter {
  private calibration: CalibrationParams;
  
  constructor(calibration?: CalibrationParams) {
    // Default calibration (identity mapping)
    this.calibration = calibration || {
      tempo: { scale: 1.0, offset: 0.0 },
      brightness: { scale: 1.0, offset: 0.0 },
      density: { scale: 1.0, offset: 0.0 },
      arc: { scale: 1.0, offset: 0.0 },
      motif: { temperature: 1.0 },
      cadence: { temperature: 1.0 }
    };
  }
  
  /**
   * Convert Student-v2 multi-head outputs to 6D control vector
   * Maintains exact same interface as Student-v1 for runtime compatibility
   */
  adapt(v2Outputs: StudentV2Outputs): ControlVector6D {
    // Apply calibration to continuous outputs
    const calibratedTempo = this.applyCalibration(v2Outputs.tempo, this.calibration.tempo);
    const calibratedBrightness = this.applyCalibration(v2Outputs.brightness, this.calibration.brightness);
    const calibratedDensity = this.applyCalibration(v2Outputs.density, this.calibration.density);
    const calibratedArc = this.applyCalibration(v2Outputs.arc, this.calibration.arc);
    
    // Apply temperature scaling to categorical outputs
    const motifProbs = this.applyTemperature(v2Outputs.motif, this.calibration.motif.temperature);
    const cadenceProbs = this.applyTemperature(v2Outputs.cadence, this.calibration.cadence.temperature);
    
    // Convert softmax to discrete selections
    const motifSelection = this.selectFromSoftmax(motifProbs);
    const cadenceSelection = this.selectFromSoftmax(cadenceProbs);
    
    return {
      tempo: Math.max(0, Math.min(1, calibratedTempo)),
      brightness: Math.max(0, Math.min(1, calibratedBrightness)),
      density: Math.max(0, Math.min(1, calibratedDensity)),
      arc: Math.max(0, Math.min(1, calibratedArc)),
      motifSelection,
      cadenceSelection
    };
  }
  
  /**
   * Convert 6D control vector to array format (for compatibility with existing code)
   */
  toArray(controlVector: ControlVector6D): number[] {
    return [
      controlVector.tempo,
      controlVector.brightness,
      controlVector.density,
      controlVector.arc,
      controlVector.motifSelection / 7.0, // Normalize to 0..1
      controlVector.cadenceSelection / 3.0 // Normalize to 0..1
    ];
  }
  
  /**
   * Load calibration parameters from model metadata
   */
  static fromMetadata(metadata: any): StudentV2Adapter {
    const calibration = metadata.calibration;
    if (calibration) {
      return new StudentV2Adapter(calibration);
    }
    console.warn('[Adapter] No calibration found in metadata, using default identity mapping');
    return new StudentV2Adapter();
  }
  
  private applyCalibration(value: number, params: { scale: number; offset: number }): number {
    return value * params.scale + params.offset;
  }
  
  private applyTemperature(probs: number[], temperature: number): number[] {
    if (temperature === 1.0) return [...probs];
    
    // Apply temperature scaling
    const scaled = probs.map(p => Math.exp(Math.log(p) / temperature));
    const sum = scaled.reduce((a, b) => a + b, 0);
    return scaled.map(p => p / sum);
  }
  
  private selectFromSoftmax(probs: number[]): number {
    // Sample from categorical distribution
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (random <= cumulative) {
        return i;
      }
    }
    
    // Fallback to argmax if something goes wrong
    return probs.indexOf(Math.max(...probs));
  }
  
  /**
   * Log adaptation details for debugging
   */
  logAdaptation(v2Outputs: StudentV2Outputs, controlVector: ControlVector6D): void {
    console.log('[Adapter] Student-v2 → 6D Control Vector:');
    console.log(`  Tempo: ${v2Outputs.tempo.toFixed(3)} → ${controlVector.tempo.toFixed(3)}`);
    console.log(`  Brightness: ${v2Outputs.brightness.toFixed(3)} → ${controlVector.brightness.toFixed(3)}`);
    console.log(`  Density: ${v2Outputs.density.toFixed(3)} → ${controlVector.density.toFixed(3)}`);
    console.log(`  Arc: ${v2Outputs.arc.toFixed(3)} → ${controlVector.arc.toFixed(3)}`);
    console.log(`  Motif: [${v2Outputs.motif.map(p => p.toFixed(2)).join(', ')}] → ${controlVector.motifSelection}`);
    console.log(`  Cadence: [${v2Outputs.cadence.map(p => p.toFixed(2)).join(', ')}] → ${controlVector.cadenceSelection}`);
  }
}
